// Online play: 1v1 and 2v2 team deathmatch with friends, first to 10.
//
// By default rooms run through a public MQTT message server over a secure WebSocket (RelayTransport), which gets
// through networks that block direct connections. `?net=p2p` uses WebRTC through PeerJS instead (player to player). The host's room code is the host's peer id; everyone else connects to the host, and the
// host relays messages between them (a star). Each player simulates their own movement and shooting and reports
// it: positions ~20 times a second, shots for tracers, and hits to the player they hit, who applies the damage.
// The host keeps the score and calls the winner.
//
// For testing, `?net=local` swaps WebRTC for a BroadcastChannel, so two tabs in one browser can play each other.
import { ropeParts, hookParts } from './gadgets.js';
import { Bot, teamPalette } from './bots.js';
import { compose, mat4 } from './math.js';
import { TEAM_NAMES } from './matchmaking.js';
import { CLASSES } from './classes.js';
import { Agent, Deathmatch } from './tdm.js';
import { Nav } from './nav.js';
const BOT_NAMES = ['BOT·VEX', 'BOT·RIVET', 'BOT·NOVA', 'BOT·KOI', 'BOT·DASH', 'BOT·ORBIT', 'BOT·FLINT'];

export const NET_GOAL = 10;
const PEERJS = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const PREFIX = 'semifinals-room-';
const SEND_HZ = 15;     // position updates per second (through the relay server)
const TYPE_OF = { light: 'rusher', medium: 'rifle', heavy: 'heavy' };
const COLS = ['#ff7a1a', '#2f8cff'];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const code5 = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const rid = () => Math.random().toString(36).slice(2, 10);

// ---------------------------------------------------------------- transports
// host: listen(code) → onPeer(id), onData(id, msg), onLeave(id), sendTo(id, msg)
// client: connect(code) → onData(msg), onLeave(), send(msg)
let peerLib = null;
function loadPeerJS() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (peerLib) return peerLib;
  peerLib = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = PEERJS; s.async = true;
    s.onload = () => (window.Peer ? res(window.Peer) : rej(new Error('PeerJS failed to load')));
    s.onerror = () => { peerLib = null; rej(new Error("Couldn't load the online library. Check your connection.")); };
    document.head.append(s);
  });
  return peerLib;
}

// How players find each other through firewalls: STUN works out each player's public address; when a network won't
// let two players talk directly (common on school, work and mobile networks), TURN relays the traffic instead.
const ICE = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'],
      username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};
const PEER_OPTS = { config: ICE, debug: 1 };
const ERR = {
  noRoom: "NO ROOM WITH THAT CODE. CHECK IT, AND THAT THE HOST HASN'T CLOSED THEIR GAME.",
  blocked: "FOUND THE ROOM BUT COULDN'T CONNECT. YOUR NETWORK MAY BE BLOCKING IT: TRY AGAIN, OR TRY ANOTHER NETWORK (LIKE A PHONE HOTSPOT).",
  server: "COULDN'T REACH THE ONLINE SERVER. CHECK YOUR INTERNET AND TRY AGAIN.",
};

class PeerTransport {
  constructor() { this.conns = new Map(); this.id = null; }
  async listen(code) {
    const Peer = await loadPeerJS();
    return new Promise((res, rej) => {
      const peer = new Peer(PREFIX + code, PEER_OPTS);
      this.peer = peer;
      let opened = false;
      const fail = setTimeout(() => { if (!opened) rej(new Error(ERR.server)); }, 15000);
      peer.on('open', (id) => { opened = true; clearTimeout(fail); this.id = id; res(code); });
      peer.on('error', (e) => {
        if (!opened) { clearTimeout(fail); rej(new Error(e.type === 'unavailable-id' ? 'taken' : ['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type) ? ERR.server : e.message || String(e))); }
      });
      // lost the matchmaking server (not the players): get back on it with the same code
      peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => { try { peer.reconnect(); } catch { /* ignore */ } }, 1000); });
      peer.on('connection', (c) => {
        c.on('open', () => { this.conns.set(c.peer, c); this.onPeer?.(c.peer); });
        c.on('data', (d) => this.onData?.(c.peer, d));
        c.on('close', () => { if (this.conns.get(c.peer) === c) { this.conns.delete(c.peer); this.onLeave?.(c.peer); } });
        c.on('error', () => { if (this.conns.get(c.peer) === c) { this.conns.delete(c.peer); this.onLeave?.(c.peer); } });
      });
    });
  }
  async connect(code, onStatus) {
    const Peer = await loadPeerJS();
    // get on the matchmaking server first
    const peer = await new Promise((res, rej) => {
      const p = new Peer(PEER_OPTS);
      const fail = setTimeout(() => rej(new Error(ERR.server)), 15000);
      p.on('open', (id) => { clearTimeout(fail); this.id = id; res(p); });
      p.on('error', (e) => { clearTimeout(fail); rej(new Error(ERR.server + ` (${e.type || e.message})`)); });
    });
    this.peer = peer;
    peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => { try { peer.reconnect(); } catch { /* ignore */ } }, 1000); });
    // then try the host a few times (the first try sometimes loses the race with the network setup)
    let lastErr = ERR.blocked;
    for (let attempt = 1; attempt <= 3; attempt++) {
      onStatus?.(attempt === 1 ? 'CONNECTING TO THE HOST…' : `RETRYING (${attempt}/3)…`);
      try {
        await new Promise((res, rej) => {
          const c = peer.connect(PREFIX + code, { serialization: 'json' });
          const done = (err) => { clearTimeout(fail); peer.off?.('error', onErr); if (err) { try { c.close(); } catch { /* ignore */ } rej(err); } else res(); };
          const onErr = (e) => { if (e.type === 'peer-unavailable') done(Object.assign(new Error(ERR.noRoom), { fatal: true })); };
          const fail = setTimeout(() => done(new Error(ERR.blocked)), 14000);
          peer.on('error', onErr);
          c.on('open', () => {
            this.host = c;
            c.on('data', (d) => this.onData?.(d));
            c.on('close', () => this.onLeave?.());
            done();
          });
          c.on('error', () => done(new Error(ERR.blocked)));
          // ICE gave up on every route: no point waiting out the timer
          const watch = setInterval(() => {
            const st = c.peerConnection?.iceConnectionState;
            if (st === 'failed') { clearInterval(watch); done(new Error(ERR.blocked)); }
            if (c.open || st === 'connected' || st === 'completed') clearInterval(watch);
          }, 300);
          setTimeout(() => clearInterval(watch), 15000);
        });
        return this.id;
      } catch (e) {
        lastErr = e.message;
        if (e.fatal) break;
      }
    }
    throw new Error(lastErr);
  }
  sendTo(id, msg) { const c = this.conns.get(id); if (c?.open) c.send(msg); }
  send(msg) { if (this.host?.open) this.host.send(msg); }
  close() { try { this.peer?.destroy(); } catch { /* ignore */ } this.conns.clear(); }
}

// ---------------------------------------------------------------- relay transport (the default)
// Game traffic goes through a public MQTT message server over a normal secure WebSocket, so it works on networks that
// block direct player-to-player connections (school, work, mobile). The host picks the first server that answers and
// posts a "beacon" there; a joiner checks every server for that room's beacon and joins on the one the host is using.
const MQTTJS = 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js';
const BROKERS = [
  { name: 'shiftr', url: 'wss://public.cloud.shiftr.io', username: 'public', password: 'public' },
  { name: 'emqx', url: 'wss://broker.emqx.io:8084/mqtt' },
  { name: 'hivemq', url: 'wss://broker.hivemq.com:8884/mqtt' },
  { name: 'mosquitto', url: 'wss://test.mosquitto.org:8081/mqtt' },
];
const TOPIC = 'semifinals-tsf/v1/';
let mqttLib = null;
function loadMQTT() {
  if (window.mqtt) return Promise.resolve(window.mqtt);
  if (mqttLib) return mqttLib;
  mqttLib = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = MQTTJS; s.async = true;
    s.onload = () => (window.mqtt ? res(window.mqtt) : rej(new Error("COULDN'T LOAD THE ONLINE LIBRARY.")));
    s.onerror = () => { mqttLib = null; rej(new Error("COULDN'T LOAD THE ONLINE LIBRARY. CHECK YOUR CONNECTION.")); };
    document.head.append(s);
  });
  return mqttLib;
}
// connect to one broker; resolves with the client once connected, rejects on timeout / error
function openBroker(mqtt, b, id) {
  return new Promise((res, rej) => {
    let c;
    try {
      c = mqtt.connect(b.url, { clientId: `tsf_${id}_${Math.random().toString(36).slice(2, 6)}`, username: b.username, password: b.password,
        clean: true, connectTimeout: 7000, reconnectPeriod: 0, keepalive: 20, protocolVersion: 4 });
    } catch (e) { rej(e); return; }
    const t = setTimeout(() => { try { c.end(true); } catch { /* ignore */ } rej(new Error('timeout')); }, 8000);
    c.once('connect', () => { clearTimeout(t); c.options.reconnectPeriod = 2000; res(c); });
    c.once('error', (e) => { clearTimeout(t); try { c.end(true); } catch { /* ignore */ } rej(e); });
  });
}
const firstOf = (ps) => new Promise((res, rej) => {
  let left = ps.length;
  if (!left) rej(new Error('none'));
  ps.forEach((p) => p.then(res, () => { if (--left === 0) rej(new Error('none')); }));
});

class RelayTransport {
  constructor() { this.id = rid(); this.peers = new Map(); }   // peer id -> last heard (ms)
  pub(topic, obj, retain = false) { try { this.c?.publish(TOPIC + this.code + topic, JSON.stringify(obj), { qos: 0, retain }); } catch { /* ignore */ } }
  async listen(code) {
    const mqtt = await loadMQTT();
    this.code = code;
    const tries = BROKERS.map((b) => openBroker(mqtt, b, this.id).then((c) => ({ c, b })));
    let got;
    try { got = await firstOf(tries); } catch { throw new Error("COULDN'T REACH ANY GAME SERVER. CHECK YOUR INTERNET AND TRY AGAIN."); }
    this.c = got.c; this.broker = got.b.name;
    // drop the other servers that also answered
    tries.forEach((p) => p.then(({ c }) => { if (c !== this.c) c.end(true); }, () => {}));
    this.c.subscribe(TOPIC + code + '/h');
    this.c.on('message', (topic, buf) => {
      let m; try { m = JSON.parse(buf.toString()); } catch { return; }
      if (!m || !m.from) return;
      const known = this.peers.has(m.from);
      this.peers.set(m.from, Date.now());
      if (m.kind === 'hello') { this.pub('/c/' + m.from, { kind: 'welcome', from: 'host' }); if (!known) this.onPeer?.(m.from); }
      else if (m.kind === 'bye') { this.peers.delete(m.from); this.onLeave?.(m.from); }
      else if (m.kind === 'ping') { /* keep-alive */ }
      else if (known) this.onData?.(m.from, m.msg);
    });
    // beacon (so joiners can find this server) + keep-alives + drop players that went quiet
    const beat = () => {
      this.pub('/beacon', { t: Date.now(), broker: this.broker }, true);
      for (const [p, t] of this.peers) { this.pub('/c/' + p, { kind: 'ping', from: 'host' }); if (Date.now() - t > 9000) { this.peers.delete(p); this.onLeave?.(p); } }
    };
    beat();
    this.timer = setInterval(beat, 2500);
    return code;
  }
  async connect(code, onStatus) {
    const mqtt = await loadMQTT();
    this.code = code;
    onStatus?.('LOOKING FOR THE ROOM…');
    // every server we can reach; the one carrying this room's fresh beacon wins
    const found = await new Promise((res, rej) => {
      const clients = [];
      let pending = BROKERS.length, done = false;
      const finish = (val, err) => {
        if (done) return; done = true; clearTimeout(t);
        for (const c of clients) if (!val || c !== val.c) { try { c.end(true); } catch { /* ignore */ } }
        if (val) res(val); else rej(err);
      };
      const t = setTimeout(() => finish(null, new Error(clients.length
        ? "NO ROOM WITH THAT CODE. CHECK IT, AND THAT THE HOST'S GAME IS STILL OPEN ON THE ONLINE SCREEN."
        : "COULDN'T REACH ANY GAME SERVER. CHECK YOUR INTERNET AND TRY AGAIN.")), 12000);
      BROKERS.forEach((b) => openBroker(mqtt, b, this.id).then((c) => {
        if (done) { c.end(true); return; }
        clients.push(c);
        c.subscribe(TOPIC + code + '/beacon');
        c.on('message', (topic, buf) => {
          if (!topic.endsWith('/beacon')) return;
          let m; try { m = JSON.parse(buf.toString()); } catch { return; }
          if (m && m.t && Math.abs(Date.now() - m.t) < 5 * 60 * 1000) finish({ c, b });
        });
      }, () => { if (--pending === 0 && !clients.length) finish(null, new Error("COULDN'T REACH ANY GAME SERVER. CHECK YOUR INTERNET AND TRY AGAIN.")); }));
    });
    this.c = found.c; this.broker = found.b.name;
    this.c.unsubscribe(TOPIC + code + '/beacon');
    onStatus?.('JOINING…');
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("FOUND THE ROOM BUT THE HOST DIDN'T ANSWER. ASK THEM TO STAY ON THE ROOM SCREEN AND TRY AGAIN.")), 9000);
      this.lastHost = Date.now();
      this.c.subscribe(TOPIC + code + '/c/' + this.id, () => this.pub('/h', { kind: 'hello', from: this.id }));
      this.c.on('message', (topic, buf) => {
        let m; try { m = JSON.parse(buf.toString()); } catch { return; }
        if (!m) return;
        this.lastHost = Date.now();
        if (m.kind === 'welcome') { clearTimeout(t); res(); }
        else if (m.kind === 'ping') { /* keep-alive */ }
        else if (m.msg) this.onData?.(m.msg);
      });
    });
    // keep-alives both ways; if the host goes quiet for 10 s they've gone
    this.timer = setInterval(() => {
      this.pub('/h', { kind: 'ping', from: this.id });
      if (Date.now() - this.lastHost > 10000) { clearInterval(this.timer); this.onLeave?.(); }
    }, 2500);
    return this.id;
  }
  sendTo(id, msg) { this.pub('/c/' + id, { from: 'host', msg }); }
  send(msg) { this.pub('/h', { from: this.id, msg }); }
  close() {
    clearInterval(this.timer);
    if (this.c) {
      try {
        if (this.peers.size || this.timer) this.pub(this.lastHost ? '/h' : '/beacon', this.lastHost ? { kind: 'bye', from: this.id } : '', !this.lastHost);
        if (!this.lastHost) this.c.publish(TOPIC + this.code + '/beacon', '', { retain: true });   // clear the room's beacon
      } catch { /* ignore */ }
      const c = this.c;
      setTimeout(() => { try { c.end(true); } catch { /* ignore */ } }, 300);
    }
    this.c = null;
  }
}

// same API over a BroadcastChannel (tabs in one browser), for testing
class LocalTransport {
  constructor() { this.id = rid(); this.peers = new Set(); }
  async listen(code) {
    this.ch = new BroadcastChannel('tsf-' + code);
    this.ch.onmessage = ({ data: m }) => {
      if (m.to !== this.id && m.to !== 'host') return;
      if (m.kind === 'hello') { this.peers.add(m.from); this.ch.postMessage({ to: m.from, kind: 'welcome', from: this.id }); this.onPeer?.(m.from); }
      else if (m.kind === 'bye') { this.peers.delete(m.from); this.onLeave?.(m.from); }
      else this.onData?.(m.from, m.msg);
    };
    return code;
  }
  async connect(code) {
    this.ch = new BroadcastChannel('tsf-' + code);
    return new Promise((res, rej) => {
      const fail = setTimeout(() => rej(new Error('No room with that code.')), 3000);
      this.ch.onmessage = ({ data: m }) => {
        if (m.to !== this.id) return;
        if (m.kind === 'welcome') { clearTimeout(fail); this.hostId = m.from; res(this.id); }
        else if (m.kind === 'bye') this.onLeave?.();
        else this.onData?.(m.msg);
      };
      this.ch.postMessage({ to: 'host', kind: 'hello', from: this.id });
    });
  }
  sendTo(id, msg) { this.ch?.postMessage({ to: id, from: this.id, msg }); }
  send(msg) { this.ch?.postMessage({ to: this.hostId || 'host', from: this.id, msg }); }
  close() {
    if (this.ch) {
      if (this.hostId) this.ch.postMessage({ to: this.hostId, kind: 'bye', from: this.id });
      else for (const p of this.peers) this.ch.postMessage({ to: p, kind: 'bye', from: this.id });
      this.ch.close();
    }
    this.ch = null;
  }
}

// ---------------------------------------------------------------- someone else, as seen on my screen
class Remote {
  constructor(world, info, team) {
    Object.assign(this, { world, id: info.id, name: info.name, cls: info.cls, team, isPlayer: false, isRemote: true });
    this.target = null; this.bot = null; this.dead = false;
    this.hp = 1; this.maxHp = 1; this.wep = null;
  }
  spawn(pos, yaw) {
    if (this.bot && !this.bot.removed) { this.bot.remove(); this.bot.removed = true; }
    const b = new Bot(this.world, TYPE_OF[this.cls] || 'rifle', pos, yaw, 0);
    b.state = 'wait'; b.landed = true; b.dropT = 1;
    b.name = this.name; b.pal = teamPalette(this.team.rgb); b.team = this.team.idx;
    b.remote = this; b.agent = this;
    b.place();
    this.bot = b; this.dead = false;
  }
  get pos() { return this.bot ? this.bot.pos : [0, -999, 0]; }
  get alive() { return !!this.bot && this.bot.alive && !this.dead; }
  get downed() { return !!this.bot && !this.bot.alive && !!this.bot.downed; }
  eye() { return this.bot.eye(); }
  get hpFrac() { return this.maxHp ? this.hp / this.maxHp : 1; }

  // a state packet: { p, y, pi, hp, mh, d, c, w }
  state(s) {
    this.hp = s.hp; this.maxHp = s.mh; this.wep = s.w; this.gr = s.gr || null; this.cl = !!s.cl;
    if (s.d) return;
    if (!this.bot || this.dead || this.bot.removed) { this.spawn(s.p, s.y); }
    this.target = s;
  }
  update(dt, g) {
    const b = this.bot;
    if (!b) return;
    if (!b.alive) {
      if (b.dying >= 0) {
        b.dying += dt; b.flash -= dt;
        if (b.dying > 9.6) b.downed = false;          // about to respawn: the body goes
        if (b.dying > 0.75 && !b.downed && !b.shattered) { b.shattered = true; b.remove(); b.removed = true; g.onShatter?.(b); }
      }
      return;
    }
    const t = this.target;
    if (t) {
      const d = Math.hypot(t.p[0] - b.pos[0], t.p[1] - b.pos[1], t.p[2] - b.pos[2]);
      const k = d > 5 ? 1 : Math.min(1, dt * 14);
      for (let i = 0; i < 3; i++) b.pos[i] += (t.p[i] - b.pos[i]) * k;
      let dy = t.y - b.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      b.yaw += dy * Math.min(1, dt * 16);
      b.aimPitch += (t.pi - b.aimPitch) * Math.min(1, dt * 16);
    }
    // animation bookkeeping (as the AI agents do)
    b.flash -= dt; b.muzzleT -= dt;
    b.recoil *= Math.exp(-16 * dt); b.flinch *= Math.exp(-7 * dt); b.landK *= Math.exp(-3.5 * dt);
    b.breath += dt;
    const vx = (b.pos[0] - b.lastPos[0]) / Math.max(dt, 1e-4), vz = (b.pos[2] - b.lastPos[2]) / Math.max(dt, 1e-4);
    b.lastPos = [...b.pos];
    const cy = Math.cos(b.yaw), sy = Math.sin(b.yaw);
    b.localVel[0] += ((cy * vx - sy * vz) - b.localVel[0]) * Math.min(1, dt * 10);
    b.localVel[1] += ((sy * vx + cy * vz) - b.localVel[1]) * Math.min(1, dt * 10);
    const sp = Math.hypot(vx, vz);
    b.moving += ((sp > 0.5 ? 1 : 0) - b.moving) * Math.min(1, dt * 8);
    b.walk += dt * sp * 2.2;
    b.place();
  }
  kill(dir) {
    if (!this.bot || !this.bot.alive) { this.dead = true; return; }
    this.bot.damage(1e6, dir || [0, 0, 1]);
    this.bot.downed = true;          // lies there until their respawn (or a takedown)
    this.dead = true;
  }
  remove() { if (this.bot && !this.bot.removed) { this.bot.remove(); this.bot.removed = true; } }
}

// ---------------------------------------------------------------- the online match (same shape as Deathmatch, for the HUD)
export class Online {
  constructor(world, ui) {
    this.world = world;
    this.ui = ui;                 // { root, onStart(info), onEnd(), getName(), getClass(), arenas: [names] }
    this.active = false;          // a match is running
    this.inRoom = false;
    this.agents = [];
    this.events = [];
    this.box = { carrier: null };
    this.local = /[?&]net=local/.test(location.search);
    this.p2p = /[?&]net=p2p/.test(location.search);
    this.sendT = 0;
    this.parts = [];
  }

  makeTransport() { return this.local ? new LocalTransport() : this.p2p ? new PeerTransport() : new RelayTransport(); }

  // ---------------- lobby
  async host(mode, arena) {
    this.leave();
    this.isHost = true; this.mode = mode; this.arenaPick = arena;
    this.fill = true;              // bots fill the empty slots
    this.max = mode === '2v2' ? 4 : 2;
    let code;
    for (let tries = 0; tries < 4; tries++) {
      this.tx = this.makeTransport();
      try { code = await this.tx.listen(code5()); break; } catch (e) { this.tx.close(); if (e.message !== 'taken') throw e; }
    }
    this.code = code;
    this.myId = this.tx.id || 'host';
    this.players = [{ id: this.myId, name: this.ui.getName(), cls: this.ui.getClass(), team: 0 }];
    this.teamNames = [...TEAM_NAMES].sort(() => Math.random() - 0.5).slice(0, 2);
    this.tx.onPeer = () => {};
    this.tx.onData = (id, m) => this.hostData(id, m);
    this.tx.onLeave = (id) => this.dropPlayer(id);
    this.inRoom = true;
    this.pushLobby();
    return code;
  }

  async join(code) {
    this.leave();
    this.isHost = false;
    this.tx = this.makeTransport();
    this.code = code.toUpperCase().trim();
    this.myId = await this.tx.connect(this.code, (m) => this.ui.status?.(m));
    this.tx.onData = (m) => this.handle(m);
    this.tx.onLeave = () => { this.ui.status?.('THE HOST LEFT'); this.ui.onHostLeft?.(); this.leave(); };
    this.inRoom = true;
    this.tx.send({ t: 'hello', id: this.myId, name: this.ui.getName(), cls: this.ui.getClass() });
  }

  leave() {
    if (this.active) this.stop();
    if (this.tx) { try { this.isHost ? this.broadcast({ t: 'closed' }) : this.tx.send({ t: 'bye', id: this.myId }); } catch { /* ignore */ } this.tx.close(); }
    this.tx = null; this.inRoom = false; this.players = []; this.lobby = null;
  }

  // host: someone said something
  hostData(from, m) {
    if (m.t === 'hello') {
      if (this.active) { this.tx.sendTo(from, { t: 'refused', why: 'MATCH IN PROGRESS' }); return; }
      if (this.players.length >= this.max) { this.tx.sendTo(from, { t: 'refused', why: 'ROOM FULL' }); return; }
      const n = [0, 1].map((k) => this.players.filter((p) => p.team === k).length);
      this.players.push({ id: from, name: String(m.name || 'PLAYER').slice(0, 16), cls: CLASSES[m.cls] ? m.cls : 'medium', team: n[0] <= n[1] ? 0 : 1 });
      this.pushLobby();
      return;
    }
    if (m.t === 'bye') { this.dropPlayer(from); return; }
    if (m.t === 'cls') { const p = this.players.find((q) => q.id === from); if (p && CLASSES[m.cls]) { p.cls = m.cls; this.pushLobby(); } return; }
    // game traffic: relay it on (to one player, or everyone else), and act on it here too
    if (m.to) { if (m.to === this.myId || this.byId(m.to)?.isAI) this.handle(m); else this.tx.sendTo(m.to, m); }
    else { for (const p of this.players) if (p.id !== this.myId && p.id !== from) this.tx.sendTo(p.id, m); this.handle(m); }
  }

  dropPlayer(id) {
    const i = this.players.findIndex((p) => p.id === id);
    if (i < 0) return;
    const p = this.players[i];
    this.players.splice(i, 1);
    this.broadcast({ t: 'left', id, name: p.name });
    this.handle({ t: 'left', id, name: p.name });
    if (!this.active) this.pushLobby();
  }

  pushLobby() {
    this.lobby = { t: 'lobby', code: this.code, mode: this.mode, max: this.max, players: this.players, teamNames: this.teamNames, arena: this.arenaPick };
    this.broadcast(this.lobby);
    this.ui.lobby?.(this.lobby, true);
  }

  // host: switch someone's team (2v2) or kick off
  swapTeam(id) {
    const p = this.players.find((q) => q.id === id);
    if (!p || this.active) return;
    const other = 1 - p.team, cap = this.max / 2;
    if (this.players.filter((q) => q.team === other).length >= cap) return;
    p.team = other;
    this.pushLobby();
  }
  canStart() {
    if (!this.isHost || this.active) return false;
    if (this.fill) return this.players.some((p) => !p.bot);
    return this.players.length >= 2 && [0, 1].every((k) => this.players.some((p) => p.team === k));
  }
  startMatch() {
    if (!this.canStart()) return;
    const arena = this.arenaPick >= 0 ? this.arenaPick : Math.floor(Math.random() * this.ui.arenas.length);
    // fill the empty slots with bots (they run on my machine)
    this.players = this.players.filter((p) => !p.bot);
    if (this.fill) {
      const cap = this.max / 2, names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
      for (const k of [0, 1]) {
        while (this.players.filter((p) => p.team === k).length < cap) {
          const n = this.players.filter((p) => p.bot).length;
          this.players.push({ id: `bot-${n + 1}-${Math.floor(Math.random() * 1e4)}`, name: names[n] || `BOT ${n + 1}`, cls: ['light', 'medium', 'heavy'][Math.floor(Math.random() * 3)], team: k, bot: true });
        }
      }
    }
    const msg = { t: 'start', arena, players: this.players, teamNames: this.teamNames, mode: this.mode };
    this.broadcast(msg);
    this.handle(msg);
  }

  // after a match: everyone back in for another (new arena if it's random), bots topped up again
  rematch() { if (this.isHost && this.over) { this.active = false; this.startMatch(); } }

  broadcast(m) { if (this.isHost) for (const p of this.players) if (p.id !== this.myId && !p.bot) this.tx.sendTo(p.id, m); }
  // send game traffic: the host handles it and relays; clients send it to the host
  send(m) {
    if (!this.tx) return;
    if (this.isHost) { if (m.to) { if (m.to !== this.myId) this.tx.sendTo(m.to, m); } else this.broadcast(m); }
    else this.tx.send(m);
  }

  // ---------------- messages (everyone)
  handle(m) {
    switch (m.t) {
      case 'lobby': this.lobby = m; this.players = m.players; this.ui.lobby?.(m, false); break;
      case 'refused': this.ui.status?.(m.why); this.leave(); this.ui.lobby?.(null, false); break;
      case 'closed': this.ui.status?.('THE HOST CLOSED THE ROOM'); if (this.active) this.ui.onHostLeft?.(); this.leave(); this.ui.lobby?.(null, false); break;
      case 'start': this.begin(m); break;
      case 'st': { const r = this.byId(m.id); if (r) r.state(m); break; }
      case 'shot': { if (m.id === this.myId || this.byId(m.id)?.isAI) break; const r = this.byId(m.id); if (r?.bot?.alive) { r.bot.muzzleT = 0.05; r.bot.recoil = 1; } this.g?.remoteShot(m.f, m.e, r); break; }
      case 'gad': if (m.id !== this.myId && this.active) this.g?.remoteGadget?.(m.g); break;
      case 'gl': case 'boom': case 'drn': case 'tsh': case 'trap': case 'trapgone': case 'teth': case 'gdel': if (m.id !== this.myId && this.active) this.g?.remoteHeavy?.(m); break;
      case 'gdm': if (this.active) this.g?.remoteGadgetHit?.(m.gid, m.dmg); break;
      case 'td': if (m.id !== this.myId && this.active) this.onTakedown(m); break;
      case 'chk': if (m.id !== this.myId && this.active) this.g?.remoteChunks?.(m.h); break;
      case 'hit':
        if (m.to === this.myId && this.active) this.g?.remoteHit(m.dmg, m.f, this.nameOf(m.by), m.by, m.head);
        else if (this.isHost && this.active) {
          // someone shot one of my bots
          const a = this.byId(m.to);
          if (a?.isAI && a.bot.alive) { a.lastHitBy = m.by === this.myId ? this.you : this.byId(m.by) || null; a.bot.damage(m.dmg, [0, 0, 1]); }
        }
        break;
      case 'died': this.onDied(m); break;
      case 'score': if (this.teams) { this.teams.forEach((t, i) => { t.kills = m.k[i]; }); if (m.over != null && !this.over) this.finish(this.teams[m.over]); } break;
      case 'left': {
        const r = this.byId(m.id);
        if (r) { r.remove(); this.agents = this.agents.filter((a) => a !== r); }
        if (this.active) this.g?.banner(`${m.name} LEFT`, 'DISCONNECTED', 'bad', 1.6);
        break;
      }
      default: break;
    }
  }

  nameOf(id) { return id === this.myId ? 'YOU' : this.players.find((p) => p.id === id)?.name || '?'; }
  byId(id) { return this.agents.find((a) => a.id === id); }

  // ---------------- the match
  begin(m) {
    this.players = m.players;
    const me = m.players.find((p) => p.id === this.myId);
    if (!me) return;
    this.teams = [0, 1].map((i) => ({ name: m.teamNames[i], col: COLS[i === me.team ? 0 : 1], rgb: hex(COLS[i === me.team ? 0 : 1]), idx: i, mine: i === me.team, kills: 0 }));
    this.myTeam = this.teams[me.team];
    this.arena = m.arena;
    this.mode = m.mode;
    this.over = null;
    this.ui.onStart({ arena: m.arena, team: me.team, teams: this.teams, mode: m.mode });   // sets up the arena, places the player, sets this.g
    const player = this.g.player;
    this.you = { isPlayer: true, team: this.myTeam, name: 'YOU', id: this.myId, get pos() { return player.pos; }, get alive() { return !player.dead; }, get downed() { return !!player.downed; }, eye: () => player.eye() };
    this.agents.forEach((a) => a.remove());
    this.kd = {};
    this.co = null;
    this.agents = m.players.filter((p) => p.id !== this.myId).map((p) => (p.bot && this.isHost ? this.makeBot(p) : new Remote(this.world, p, this.teams[p.team])));
    if (this.co) this.co.agents = this.agents.filter((a) => a.isAI);
    this.active = true;
    this.t = 0;
    this.events.push({ type: 'start' });
  }

  // ---------------- bots (host only): the same AI as offline matches, with the online match as its coordinator
  makeBot(p) {
    if (!this.co) {
      const map = this.g.stadium;
      if (!map.navObj) { map.navObj = new Nav(this.world); map.navObj.build(map.nav); }
      this.teams.forEach((t, i) => { t.spawn = map.spawns[i]; t.intel = new Map(); });
      const co = Object.create(Deathmatch.prototype);
      Object.assign(co, { world: this.world, map, nav: map.navObj, teams: this.teams, myTeam: this.myTeam, you: this.you, player: this.g.player, agents: [], active: true, t: 0, events: [], over: null });
      co.anchors = co.highSpots();
      co.entities = () => this.entities();
      // a bot went down: tell everyone, the same way a player's death is reported
      co.onDeath = (a) => {
        const by = a.lastHitBy, byId = by === this.you ? this.myId : by?.id ?? null;
        a.lastHitBy = null;
        const msg = { t: 'died', id: a.id, by: byId };
        this.send(msg); this.onDied(msg);
      };
      // a bot shot another player: their game takes the damage
      co.netHit = (tgt, dmg, agent, from) => this.send({ t: 'hit', to: tgt.id, by: agent.id, dmg, head: false, f: from.map((v) => +v.toFixed(2)) });
      this.co = co;
    }
    const slot = this.players.filter((q) => q.team === p.team).findIndex((q) => q.id === p.id);
    const a = new Agent(this.co, this.teams[p.team], { name: p.name, cls: p.cls }, slot + 1);
    Object.assign(a, { id: p.id, isAI: true, kill() {}, remove() { if (this.bot && !this.bot.removed) { this.bot.remove(); this.bot.removed = true; } } });
    return a;
  }

  stop() {
    this.agents.forEach((a) => a.remove());
    this.agents = [];
    this.active = false;
  }

  entities() { return [this.you, ...this.agents]; }

  // ---- my own events, reported by the game
  myShot(from, end) { this.send({ t: 'shot', id: this.myId, f: from.map((v) => +v.toFixed(2)), e: end.map((v) => +v.toFixed(2)) }); }
  myHit(remote, dmg, head, from) { this.send({ t: 'hit', to: remote.id, by: this.myId, dmg, head, f: from.map((v) => +v.toFixed(2)) }); }
  // takedowns: { t: 'td', id: who did it, v: who was downed, k: which takedown }
  myTakedown(victimId, kind, byId = this.myId) { const m = { t: 'td', id: byId, v: victimId, k: kind }; this.send(m); this.onTakedown(m); }
  onTakedown(m) {
    if (m.v === this.myId) this.g?.takenDown?.(this.nameOf(m.id), m.k);
    else { const r = this.byId(m.v); if (r?.bot) { r.bot.downed = false; this.g?.takedownFx?.(r.bot, m.k, m.id === this.myId); } }
    if (this.kd) (this.kd[m.id] ??= { k: 0, d: 0 }).td = ((this.kd[m.id].td) || 0) + 1;
    this.g?.feedTakedown?.(this.nameOf(m.id), m.k, this.nameOf(m.v));
    // the host keeps score: a takedown is a bonus point
    if (this.isHost && this.teams && !this.over) {
      const bp = this.players.find((p) => p.id === m.id);
      if (!bp) return;
      const team = this.teams[bp.team];
      team.kills++;
      const over = team.kills >= NET_GOAL ? team.idx : null;
      this.send({ t: 'score', k: this.teams.map((t) => t.kills), over });
      if (over != null) this.finish(team);
    }
  }
  myDeath(byId) { const m = { t: 'died', id: this.myId, by: byId || null }; this.send(m); this.onDied(m); }

  onDied(m) {
    if (m.id !== this.myId) { const r = this.byId(m.id); r?.kill(); }
    if (this.kd) {
      (this.kd[m.id] ??= { k: 0, d: 0 }).d++;
      if (m.by && m.by !== m.id) (this.kd[m.by] ??= { k: 0, d: 0 }).k++;
    }
    const victim = m.id === this.myId ? 'YOU' : this.nameOf(m.id);
    if (m.id !== this.myId) this.g?.feed(m.by ? this.nameOf(m.by) : '—', victim, m.by === this.myId ? this.g.weaponId() : this.byId(m.by)?.wep);
    // the host keeps score
    if (this.isHost && this.teams && !this.over) {
      const vp = this.players.find((p) => p.id === m.id);
      if (!vp) return;
      const team = this.teams[1 - vp.team];
      team.kills++;
      const over = team.kills >= NET_GOAL ? team.idx : null;
      this.send({ t: 'score', k: this.teams.map((t) => t.kills), over });
      this.events.push({ type: 'kill', team, victim: { name: victim }, killer: m.by === this.myId ? this.you : null });
      if (over != null) this.finish(team);
    } else if (this.teams) {
      const vp = this.players.find((p) => p.id === m.id);
      if (vp) this.events.push({ type: 'kill', team: this.teams[1 - vp.team], victim: { name: victim }, killer: m.by === this.myId ? this.you : null, remoteScore: true });
    }
  }

  finish(team) {
    if (this.over) return;
    this.over = { winner: team, standings: [...this.teams].sort((x, y) => y.kills - x.kills) };
    this.events.push({ type: 'end', winner: team });
  }

  // ---- per frame
  update(dt, g) {
    if (!this.active) return;
    this.t += dt;
    for (const a of this.agents) a.update(dt, a.isAI ? g.bot : g);
    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 1 / SEND_HZ;
      for (const a of this.agents) {
        if (!a.isAI) continue;
        const b = a.bot;
        this.send({ t: 'st', id: a.id, p: b.pos.map((v) => +v.toFixed(3)), y: +b.yaw.toFixed(3), pi: +(b.aimPitch || 0).toFixed(3), hp: Math.max(0, Math.round(b.hp)), mh: b.maxHp, d: b.alive ? 0 : 1, w: ({ light: 'smg', medium: 'ar', heavy: 'lmg' })[a.cls] });
      }
      const p = g.player;
      this.send({ t: 'st', id: this.myId, p: p.pos.map((v) => +v.toFixed(3)), y: +p.yaw.toFixed(3), pi: +(p.pitch || 0).toFixed(3), hp: Math.max(0, Math.round(p.hp)), mh: p.maxHp, d: p.dead ? 1 : 0, w: g.weaponId?.(), gr: g.grapplePoint?.() || undefined, cl: g.cloaked?.() ? 1 : undefined });
    }
  }

  drawParts() {
    const out = [];
    for (const a of this.agents) {
      const b = a.bot;
      if (!b || b.removed) continue;
      if (a.cl && b.alive) { if (Math.random() < 0.15) out.push(...b.parts().filter(() => Math.random() < 0.08)); continue; }   // cloaked: only a shimmer
      out.push(...b.parts());
      // their grappling line, from the hand to where it bit
      if (b.alive && a.gr) {
        const h = b.muzzle(), d = [a.gr[0] - h[0], a.gr[1] - h[1], a.gr[2] - h[2]];
        out.push(...ropeParts(h, a.gr, { thick: 0.03 }), ...hookParts(a.gr, d, 0, 1));
      }
      if (b.alive && b.muzzleT > 0) {
        const m = mat4(), s = [0.14, 0.14, 0.14];
        compose(m, b.muzzle(), [0, b.yaw, Math.random() * 3], s);
        out.push({ model: m, scale: s, color: [1, 0.85, 0.5], emissive: 1 });
      }
    }
    return out;
  }

  heard() {}
  playerAction() { return null; }
  markers() { return []; }
  objective() {
    if (!this.teams) return null;
    const me = this.myTeam, them = this.teams.find((t) => t !== me);
    if (this.over) return { text: `${this.over.winner.name} WIN`, col: this.over.winner.col, sub: `${me.kills} – ${them.kills}` };
    const lead = me.kills - them.kills;
    return { text: `${me.kills}  –  ${them.kills}`, col: lead > 0 ? me.col : lead < 0 ? them.col : '#ffffff', sub: `ONLINE ${this.mode.toUpperCase()} · FIRST TO ${NET_GOAL}` };
  }
}

// ---------------------------------------------------------------- the lobby screen
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const btn = (cls, text, fn) => { const b = el('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };
const NAME_KEY = 'semifinals.netname';

export class Lobby {
  // o: { root, arenas: [names], getClass(), sounds, onClose(), onStart(info), onHostLeft() }
  constructor(world, o) {
    this.o = o;
    this.root = o.root;
    this.mode = '1v1';
    this.arena = -1;
    this.msg = '';
    this.online = new Online(world, {
      arenas: o.arenas,
      getName: () => this.name,
      getClass: () => o.getClass(),
      lobby: (l) => { this.view = this.online.inRoom ? 'room' : 'menu'; this.render(); },
      status: (s) => { this.msg = s; this.render(); },
      onStart: (info) => { this.root.classList.add('hidden'); o.onStart(info); },
      onHostLeft: () => o.onHostLeft?.(),
    });
    try { this.name = localStorage.getItem(NAME_KEY) || ''; } catch { this.name = ''; }
    if (!this.name) this.name = 'PLAYER' + Math.floor(Math.random() * 90 + 10);
    this.view = 'menu';
  }

  get open() { return !this.root.classList.contains('hidden'); }
  show() { this.root.classList.remove('hidden'); this.view = this.online.inRoom ? 'room' : 'menu'; this.msg = ''; this.render(); }
  hide() { this.root.classList.add('hidden'); }

  saveName(v) {
    this.name = (v || '').toUpperCase().replace(/[^A-Z0-9_ -]/g, '').slice(0, 16) || this.name;
    try { localStorage.setItem(NAME_KEY, this.name); } catch { /* ignore */ }
  }

  async doHost() {
    this.msg = 'OPENING A ROOM…'; this.render();
    try { await this.online.host(this.mode, this.arena); this.msg = ''; this.view = 'room'; } catch (e) { this.msg = String(e.message || e).toUpperCase(); this.online.leave(); }
    this.render();
  }
  async doJoin(code) {
    if (!/^[A-Z0-9]{5}$/i.test(code || '')) { this.msg = 'ENTER THE 5-CHARACTER ROOM CODE'; this.render(); return; }
    this.msg = 'JOINING…'; this.render();
    try { await this.online.join(code); this.msg = ''; this.view = 'room'; } catch (e) { this.msg = String(e.message || e).toUpperCase(); this.online.leave(); }
    this.render();
  }

  render() {
    const r = this.root, on = this.online;
    r.replaceChildren();
    const box = el('div', 'nt-box');
    box.append(el('div', 'mk-kicker', 'THE SEMI-FINALS · ONLINE'));
    if (this.view === 'room' && on.inRoom) {
      const l = on.lobby;
      box.append(el('div', 'mk-title mk-title-s', on.isHost ? 'YOUR ROOM' : 'IN A ROOM'));
      const code = el('div', 'nt-code');
      code.append(el('small', null, 'ROOM CODE'), el('b', null, on.code || '…'));
      if (on.isHost) code.append(btn('nt-copy', 'COPY', () => { navigator.clipboard?.writeText(on.code); this.msg = 'CODE COPIED — SEND IT TO A FRIEND'; this.render(); }));
      box.append(code);
      if (l) {
        box.append(el('div', 'nt-meta', `${l.mode.toUpperCase()} · ${l.arena >= 0 ? this.o.arenas[l.arena] : 'RANDOM ARENA'} · FIRST TO ${NET_GOAL} KILLS${on.tx?.broker ? ' · SERVER ' + on.tx.broker.toUpperCase() : ''}`));
        const teams = el('div', 'nt-teams');
        [0, 1].forEach((k) => {
          const t = el('div', 'nt-team');
          t.style.setProperty('--t', COLS[k]);
          t.append(el('b', null, (l.teamNames || [])[k] || `TEAM ${k + 1}`));
          for (const p of l.players.filter((q) => q.team === k)) {
            const row = el('div', `nt-p${p.id === on.myId ? ' me' : ''}`);
            row.append(el('span', null, p.name + (p.id === on.myId ? ' (YOU)' : '')), el('i', null, CLASSES[p.cls]?.name || ''));
            if (on.isHost && l.max > 2) row.append(btn('nt-swap', '⇄', () => on.swapTeam(p.id)));
            t.append(row);
          }
          for (let i = l.players.filter((q) => q.team === k).length; i < l.max / 2; i++) t.append(el('div', 'nt-p empty', on.isHost && on.fill ? 'BOT (UNTIL SOMEONE JOINS)' : 'WAITING FOR PLAYER…'));
          teams.append(t);
        });
        box.append(teams);
      }
      const row = el('div', 'nt-row');
      if (on.isHost) {
        row.append(btn(`nt-fill${on.fill ? ' on' : ''}`, `BOTS FILL EMPTY SLOTS: ${on.fill ? 'ON' : 'OFF'}`, () => { on.fill = !on.fill; this.render(); }));
        const go = btn('nt-go', 'START MATCH', () => on.startMatch());
        go.disabled = !on.canStart();
        row.append(go);
      } else row.append(el('div', 'nt-wait', 'WAITING FOR THE HOST TO START…'));
      row.append(btn('nt-back', 'LEAVE', () => { on.leave(); this.view = 'menu'; this.msg = ''; this.render(); }));
      box.append(row);
    } else {
      box.append(el('div', 'mk-title mk-title-s', 'PLAY WITH FRIENDS'));
      const name = el('label', 'nt-field');
      name.append(el('small', null, 'YOUR NAME'));
      const ni = el('input'); ni.value = this.name; ni.maxLength = 16; ni.spellcheck = false;
      ni.onchange = () => this.saveName(ni.value);
      name.append(ni);
      box.append(name);
      const host = el('div', 'nt-card');
      host.append(el('b', null, 'HOST A ROOM'));
      const modes = el('div', 'nt-seg');
      for (const m of ['1v1', '2v2']) modes.append(btn(m === this.mode ? 'on' : '', m.toUpperCase(), () => { this.mode = m; this.render(); }));
      host.append(modes);
      const ar = el('div', 'nt-seg');
      [-1, ...this.o.arenas.map((_, i) => i)].forEach((i) => ar.append(btn(i === this.arena ? 'on' : '', i < 0 ? 'RANDOM' : this.o.arenas[i], () => { this.arena = i; this.render(); })));
      host.append(ar);
      host.append(btn('nt-go', 'HOST', () => { this.saveName(ni.value); this.doHost(); }));
      const join = el('div', 'nt-card');
      join.append(el('b', null, 'JOIN A ROOM'));
      const ci = el('input', 'nt-codein'); ci.placeholder = 'CODE'; ci.maxLength = 5; ci.spellcheck = false;
      ci.oninput = () => { ci.value = ci.value.toUpperCase(); };
      ci.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') { this.saveName(ni.value); this.doJoin(ci.value); } };
      ni.onkeydown = (e) => e.stopPropagation();
      join.append(ci, btn('nt-go', 'JOIN', () => { this.saveName(ni.value); this.doJoin(ci.value); }));
      const cards = el('div', 'nt-cards');
      cards.append(host, join);
      box.append(cards);
      box.append(btn('nt-back', 'BACK', () => { this.hide(); this.o.onClose?.(); }));
    }
    if (this.msg) box.append(el('div', 'nt-msg', this.msg));
    r.append(box);
  }
}

