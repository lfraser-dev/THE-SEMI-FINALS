// First-person movement: walk, sprint, crouch, slide, slide-hop chains, mantle, vault, ledge grab,
// wall run + wall jump, air strafe, step-up, AABB collision, footsteps, plus camera feel.
import { clamp, damp, forwardFrom, spring, easeOut, easeIn, smoothstep } from './math.js';

const HW = 0.3;          // half width of the player box
const STAND = 1.8;
const CROUCH = 1.1;
const STEP = 0.55;       // max height you walk up without jumping
const GRAVITY = 21;
const JUMP_V = 7.4;      // ~1.3m jump
const MANTLE_MAX = 2.15; // highest ledge (above feet) you can climb onto
const VAULT_MAX = 1.35;  // highest obstacle you can vault over
const VAULT_DEPTH = 1.7; // thickest obstacle you can vault over
const SLIDE_MIN = 5.0;   // speed needed to start a slide
const SLIDE_BOOST = 3.6;
const SLIDE_MAX = 13;
const GRAB_MAX = 2.95;   // highest ledge (above feet) you can catch and hang from
const WALLRUN_TIME = 1.45;
const WALLRUN_MIN = 6.0; // horizontal speed needed to start a wall run
const CHAIN_MAX = 5;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export const SPEED = { walk: 5.4, sprint: 8.4, crouch: 2.9, ads: 3.6 };

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = [0, 0, 0];
    this.vel = [0, 0, 0];
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.height = STAND;
    this.grounded = false;
    this.crouching = false;
    this.sliding = false;
    this.slideTime = 0;
    this.sprinting = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.slideCooldown = 0;
    this.trav = null;        // active mantle / vault: { kind, p, ... }
    this.eyeH = 1.62;
    this.stepSmooth = 0;
    this.bobT = 0;
    this.bobAmt = 0;
    this.airTime = 0;
    // springs for camera motion (position + velocity)
    this.camPitch = 0; this.camPitchV = 0;   // visual pitch nudge (landings, mantles, vaults)
    this.landOff = 0; this.landV = 0;        // eye height dip on landing
    this.events = [];        // 'jump' | 'land' | 'slide' | 'mantle' | 'vault' | 'vaultland'
    this.spawnPoint = [0, 0, 0];
    this.spawnYaw = 0;
    this.wallRun = null;     // { a: along-wall dir, n: wall normal, side, t, speed }
    this.wallCooldown = 0;
    this.lastWall = null;
    this.chain = 0;          // slide-hop combo
    this.chainWindow = 0;    // time left to slide after a slide-jump lands
    this.slideJumped = false;
    this.sinceSlide = 9;
    this.wallStepT = 0;
  }

  get mantle() { return this.trav?.kind === 'mantle'; }
  get vaulting() { return this.trav?.kind === 'vault'; }
  get hanging() { return this.trav?.kind === 'hang'; }
  get wallRunning() { return !!this.wallRun; }

  teleport(p, yaw) {
    this.pos = [...p];
    this.vel = [0, 0, 0];
    this.yaw = yaw;
    this.pitch = 0;
    this.sliding = false;
    this.crouching = false;
    this.height = STAND;
    this.trav = null;
    this.wallRun = null;
    this.chain = 0;
    this.camPitch = this.camPitchV = this.landOff = this.landV = 0;
  }

  spawn(p, yaw = 0) {
    this.spawnPoint = [...p];
    this.spawnYaw = yaw;
    this.respawn();
  }

  respawn() {
    this.pos = [...this.spawnPoint];
    this.vel = [0, 0, 0];
    this.yaw = this.spawnYaw;
    this.pitch = 0;
    this.sliding = false;
    this.trav = null;
    this.wallRun = null;
    this.chain = 0;
    this.camPitch = this.camPitchV = this.landOff = this.landV = 0;
  }

  get hSpeed() { return Math.hypot(this.vel[0], this.vel[2]); }

  overlap(h = this.height, p = this.pos) {
    return this.world.firstOverlap([p[0] - HW, p[1], p[2] - HW], [p[0] + HW, p[1] + h, p[2] + HW]);
  }

  look(dx, dy, sens) {
    this.yaw -= dx * sens;
    this.pitch = clamp(this.pitch - dy * sens, -1.55, 1.55);
  }

  update(dt, input, { ads = false, firing = false } = {}) {
    const fwdIn = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    const strafe = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wx = -sy * fwdIn + cy * strafe, wz = -cy * fwdIn - sy * strafe;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }

    const crouchHeld = input.down('ControlLeft') || input.down('KeyC');
    const crouchHit = input.hit('ControlLeft') || input.hit('KeyC');
    if (input.hit('Space')) this.jumpBuffer = 0.14;
    this.jumpBuffer -= dt;
    this.slideCooldown -= dt;
    this.wallCooldown -= dt;
    this.chainWindow -= dt;
    this.sinceSlide += dt;

    if (this.trav) {
      const k = this.trav.kind;
      if (k === 'mantle') this.updateMantle(dt);
      else if (k === 'vault') this.updateVault(dt);
      else this.updateHang(dt, fwdIn, crouchHit);
      this.cameraFeel(dt, strafe);
      return;
    }

    const wasGrounded = this.grounded;
    let hs = this.hSpeed;

    // --- slide: crouch while moving fast (also queues if pressed mid-air) ---
    if (crouchHit && !wasGrounded) this.slideQueued = 0.3;
    this.slideQueued = (this.slideQueued || 0) - dt;
    if (crouchHeld && !wasGrounded) this.slideQueued = Math.max(this.slideQueued, 0.1); // hold crouch to slide on landing
    if ((crouchHit || (this.slideQueued > 0 && crouchHeld)) && wasGrounded && hs > SLIDE_MIN && !this.sliding && this.slideCooldown <= 0) {
      this.sliding = true;
      this.slideQueued = 0;
      this.slideTime = 0;
      this.slideCooldown = 0.45;
      this.sinceSlide = 0;
      // slide-hop chain: slide again right after a slide-jump lands for extra speed
      if (this.chainWindow > 0) { this.chain = Math.min(this.chain + 1, CHAIN_MAX); this.events.push('chain'); }
      else this.chain = 0;
      this.chainWindow = 0;
      const boost = SLIDE_BOOST + this.chain * 0.55, cap = SLIDE_MAX + this.chain * 0.75;
      const target = Math.max(1, Math.min(hs + boost, cap) / hs);
      this.vel[0] *= target;
      this.vel[2] *= target;
      this.events.push('slide');
    }
    if (crouchHeld) this.crouching = true;
    else if (this.crouching && !this.overlap(STAND)) this.crouching = false;
    if (this.sliding) {
      this.slideTime += dt;
      if (!crouchHeld || (wasGrounded && this.hSpeed < 3.4)) this.sliding = false;
    }
    if (!this.crouching) this.sliding = false;
    this.height = this.crouching ? CROUCH : STAND;

    this.sprinting = input.down('ShiftLeft') && fwdIn > 0 && !this.crouching && !ads && !firing;
    let speed = this.crouching ? SPEED.crouch : this.sprinting ? SPEED.sprint : SPEED.walk;
    if (ads) speed = Math.min(speed, SPEED.ads);

    // --- wall run: overrides normal air movement while you're on a wall ---
    if (this.wallRun) this.updateWallRun(dt, fwdIn, crouchHit, strafe);
    const onWall = !!this.wallRun;

    // --- jump / vault (before friction so bunny-hops / slide-jumps keep their speed) ---
    this.coyote = wasGrounded ? 0.1 : this.coyote - dt;
    if (!onWall && this.jumpBuffer > 0 && this.coyote > 0 && fwdIn > 0 && this.tryVault()) {
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.cameraFeel(dt, strafe);
      return;
    }
    let jumped = false;
    if (!onWall && this.jumpBuffer > 0 && this.coyote > 0) {
      this.slideJumped = this.sliding || this.sinceSlide < 0.3;
      if (this.crouching && !this.overlap(STAND)) { this.crouching = false; this.height = STAND; }
      this.vel[1] = JUMP_V;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.sliding = false;
      jumped = true;
      this.events.push('jump');
    }

    // --- horizontal velocity ---
    if (onWall) {
      // handled by updateWallRun
    } else if (this.sliding && wasGrounded) {
      // slides keep most of their speed for ~0.5s, then bleed off
      const fr = this.slideTime < 0.45 ? 0.35 : 1.8;
      const f = Math.exp(-fr * dt);
      this.vel[0] = this.vel[0] * f + wx * 6 * dt;
      this.vel[2] = this.vel[2] * f + wz * 6 * dt;
    } else if (wasGrounded && !jumped) {
      // overspeed (e.g. just landed from a slide-jump or vault) decays gently instead of snapping
      const over = hs > speed + 0.5 && wl > 0;
      const k = damp(over ? 3.5 : wl > 0 ? 11 : 9, dt);
      this.vel[0] += (wx * speed - this.vel[0]) * k;
      this.vel[2] += (wz * speed - this.vel[2]) * k;
    } else if (!wasGrounded) {
      // air strafe: you can steer, but not gain much speed
      const before = hs;
      this.vel[0] += wx * 16 * dt;
      this.vel[2] += wz * 16 * dt;
      const cap = Math.max(before, speed * 0.85), now = this.hSpeed;
      if (now > cap) { this.vel[0] *= cap / now; this.vel[2] *= cap / now; }
    }

    this.vel[1] -= (onWall ? this.wallRun.grav : GRAVITY) * dt;
    const fallSpeed = this.vel[1];

    // --- integrate with collision, sub-stepped so fast movement can't tunnel ---
    const maxMove = Math.max(Math.abs(this.vel[0]), Math.abs(this.vel[1]), Math.abs(this.vel[2])) * dt;
    const steps = Math.max(1, Math.ceil(maxMove / 0.2));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.moveAxis(0, this.vel[0] * sdt);
      this.moveAxis(2, this.vel[2] * sdt);
      this.grounded = false;
      this.moveAxis(1, this.vel[1] * sdt || -0.001);
    }

    this.airTime = this.grounded ? 0 : this.airTime + dt;
    if (this.grounded) {
      if (this.wallRun) this.wallRun = null;
      this.lastWall = null;
    }
    if (this.grounded && !wasGrounded) {
      if (this.slideJumped) this.chainWindow = 0.32;
      this.slideJumped = false;
      if (fallSpeed < -5) this.events.push('land');
      if (fallSpeed < -4) {
        // springy landing: the camera dips and nods, then settles with a tiny overshoot
        const hard = -fallSpeed - 4;
        this.landV -= Math.min(2.8, 0.5 + hard * 0.22);
        this.camPitchV -= Math.min(1.1, hard * 0.09);
      }
    }

    // combo drops if you stay on the ground without sliding
    if (this.grounded && !this.sliding && this.chainWindow <= 0 && this.sinceSlide > 0.5) this.chain = 0;

    // --- in the air, holding forward: vault low walls, mantle / grab higher ledges, run on walls ---
    if (!this.grounded && !this.wallRun && fwdIn > 0 && this.airTime > 0.05) {
      let done = false;
      if (this.vel[1] < 4.5) done = this.tryVault() || this.tryMantle() || this.tryLedgeGrab();
      if (!done) this.tryWallRun(strafe);
    }

    if (this.pos[1] < -30) this.respawn();
    this.cameraFeel(dt, strafe);
  }

  // ------------------------------------------------------------------ vault
  // Over a low, thin obstacle in one fluid arc: plant a hand, swing over, keep your momentum.
  tryVault() {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const [x, y0, z] = this.pos;
    const col = (d, lo, hi, r = 0.06) => {
      const px = x + fx * d, pz = z + fz * d;
      return this.world.firstOverlap([px - r, lo, pz - r], [px + r, hi, pz + r]);
    };
    // near face of the obstacle
    let d0 = -1, b = null;
    const scan = HW + 0.6 + this.hSpeed * 0.09;   // look further ahead the faster you run
    for (let d = HW + 0.02; d <= scan; d += 0.05) {
      b = col(d, y0 + 0.05, y0 + 1.25);
      if (b) { d0 = d; break; }
    }
    if (!b) return false;
    // its top surface (follow stacked boxes up, as long as they stay vaultable)
    let top = b.max[1];
    for (let i = 0; i < 4; i++) {
      const nb = col(d0 + 0.04, top + 0.005, y0 + VAULT_MAX + 0.05);
      if (!nb) break;
      top = nb.max[1];
    }
    const rise = top - y0;
    if (rise < 0.3 || rise > VAULT_MAX) return false;
    // far face: the first spot past it that's clear at body height
    let d1 = -1;
    for (let d = d0 + 0.05; d <= d0 + VAULT_DEPTH; d += 0.05) {
      if (!col(d, y0 + 0.05, top - 0.02, 0.04)) { d1 = d; break; }
    }
    if (d1 < 0) return false;

    const pre = Math.max(0, d0 - HW - 0.03);  // how far we can move before we must be up
    const post = d1 + HW + 0.06;               // where our body clears the far side
    const land = post + 0.4;
    const apexY = top + 0.06;
    const at = (s, yy) => [x + fx * s, yy, z + fz * s];
    // room to rise, room to pass over, room to land
    if (this.world.firstOverlap([x + fx * pre - HW, y0 + 0.05, z + fz * pre - HW],
      [x + fx * pre + HW, apexY + CROUCH, z + fz * pre + HW])) return false;
    for (let s = pre; s <= land; s += 0.1) if (this.overlap(CROUCH, at(s, apexY))) return false;
    // landing height: allow small lips / floor decals on the far side
    let landY = y0;
    for (let i = 0; i < 3; i++) {
      const lp = at(land, 0);
      const g = this.world.firstOverlap([lp[0] - HW, landY + 0.001, lp[2] - HW], [lp[0] + HW, y0 + STEP, lp[2] + HW]);
      if (!g) break;
      landY = g.max[1];
    }
    if (landY > y0 + STEP || this.overlap(CROUCH, at(land, landY + 0.01))) return false;

    const v = clamp(this.hSpeed, 6, 10.5);
    const ta = Math.max(pre / v, 0.11 + rise * 0.09);
    const tb = Math.max((post - pre) / v, 0.13);
    const td = Math.max((land - post) / v, 0.1) + rise * 0.05;
    this.trav = {
      kind: 'vault', t: 0, p: 0, T: ta + tb + td, ta, tb, td,
      x, z, y0, landY, fx, fz, pre, post, land, apexY, v, rise,
    };
    this.sliding = false;
    this.crouching = true;   // tucked body for collision while airborne over the wall
    this.height = CROUCH;
    this.events.push('vault');
    return true;
  }

  updateVault(dt) {
    const m = this.trav;
    m.t = Math.min(m.t + dt, m.T);
    const t = m.t;
    let s, y;
    if (t < m.ta) {                       // hop up (a little forward if there's room)
      const u = t / m.ta;
      s = m.pre * u;
      y = m.y0 + (m.apexY - m.y0) * easeOut(u);
    } else if (t < m.ta + m.tb) {         // swing over the top
      const u = (t - m.ta) / m.tb;
      s = m.pre + (m.post - m.pre) * u;
      y = m.apexY + Math.sin(u * Math.PI) * 0.05;
    } else {                              // drop down the far side
      const u = (t - m.ta - m.tb) / m.td;
      s = m.post + (m.land - m.post) * u;
      y = m.apexY + (m.landY + 0.001 - m.apexY) * easeIn(u);
    }
    const np = [m.x + m.fx * s, y, m.z + m.fz * s];
    if (dt > 0) this.vel = np.map((c, k) => (c - this.pos[k]) / dt);
    this.pos = np;
    m.p = t / m.T;
    this.grounded = false;
    if (m.t >= m.T) {
      this.trav = null;
      const keep = m.v * 1.04;              // a vault never costs you speed
      this.vel = [m.fx * keep, -2.5, m.fz * keep];
      this.airTime = 0.1;
      if (!this.overlap(STAND)) { this.crouching = false; this.height = STAND; }
      this.landV -= 0.55;
      this.camPitchV -= 0.25;
      this.events.push('vaultland');
    }
  }

  // ------------------------------------------------------------------ mantle
  tryMantle() {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const reach = HW + 0.35;
    const probe = [this.pos[0] + fx * reach, this.pos[2] + fz * reach];
    // find a box right in front of the chest
    const b = this.world.firstOverlap(
      [probe[0] - 0.1, this.pos[1] + 0.3, probe[1] - 0.1],
      [probe[0] + 0.1, this.pos[1] + 1.4, probe[1] + 0.1]);
    if (!b) return false;
    const ledge = b.max[1];
    const rise = ledge - this.pos[1];
    if (rise < 0.4 || rise > MANTLE_MAX) return false;
    const target = [this.pos[0] + fx * 0.75, ledge + 0.01, this.pos[2] + fz * 0.75];
    if (this.overlap(CROUCH, target)) return false;                                  // no room on top
    if (this.overlap(CROUCH, [this.pos[0], ledge + 0.01, this.pos[2]])) return false; // no room to climb up
    const keep = Math.min(this.hSpeed, 6);
    this.trav = {
      kind: 'mantle', t: 0, p: 0, len: 0.3 + rise * 0.11, from: [...this.pos], to: target, keep, dir: [fx, fz], rise,
      upVel: Math.max(this.vel[1], 0),
    };
    this.vel = [0, 0, 0];
    this.sliding = false;
    this.wallRun = null;
    this.events.push('mantle');
    return true;
  }

  // ------------------------------------------------------------------ ledge grab
  // Short of a mantle? Catch the edge with both hands and hang. Space / W climbs, S / crouch drops.
  tryLedgeGrab() {
    if (this.vel[1] > 3) return false;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const [x, y0, z] = this.pos;
    let d0 = -1, b = null;
    for (let d = HW + 0.02; d <= HW + 0.5; d += 0.04) {
      const px = x + fx * d, pz = z + fz * d;
      b = this.world.firstOverlap([px - 0.08, y0 + 1.6, pz - 0.08], [px + 0.08, y0 + GRAB_MAX, pz + 0.08]);
      if (b) { d0 = d; break; }
    }
    if (!b) return false;
    const ledge = b.max[1];
    const rise = ledge - y0;
    if (rise <= MANTLE_MAX || rise > GRAB_MAX) return false;
    const hang = [x + fx * (d0 - HW - 0.03), ledge - 2.05, z + fz * (d0 - HW - 0.03)];
    if (this.overlap(STAND, hang)) return false;
    const top = [hang[0] + fx * 0.75, ledge + 0.01, hang[2] + fz * 0.75];
    if (this.overlap(CROUCH, top) || this.overlap(CROUCH, [hang[0], ledge + 0.01, hang[2]])) return false;
    this.trav = { kind: 'hang', t: 0, p: 0, from: [...this.pos], hang, top, ledge, dir: [fx, fz], held: 0 };
    this.vel = [0, 0, 0];
    this.sliding = false;
    this.wallRun = null;
    this.crouching = false;
    this.height = STAND;
    this.landV -= 0.6;           // the catch jolts the camera
    this.camPitchV -= 0.5;
    this.events.push('grab');
    return true;
  }

  updateHang(dt, fwdIn, crouchHit) {
    const m = this.trav;
    m.t += dt;
    const e = smoothstep(m.t / 0.14);  // snap onto the ledge
    this.pos = m.from.map((c, k) => c + (m.hang[k] - c) * e);
    this.vel = [0, 0, 0];
    this.grounded = false;
    m.p = Math.min(m.t / 0.14, 1);
    if (m.t < 0.14) return;
    m.held = fwdIn > 0 ? m.held + dt : 0;
    if (this.jumpBuffer > 0 || m.held > 0.3) {
      // pull up: a slower, heavier mantle
      this.jumpBuffer = 0;
      this.trav = {
        kind: 'mantle', pull: true, t: 0, p: 0, len: 0.62, from: [...m.hang], to: m.top, keep: 3,
        dir: m.dir, rise: m.ledge - m.hang[1],
      };
      this.events.push('mantle');
    } else if (crouchHit || fwdIn < 0) {
      this.trav = null;
      this.vel = [-m.dir[0] * 1.5, 0, -m.dir[1] * 1.5];
      this.airTime = 0.3;          // no instant re-grab
      this.wallCooldown = 0.3;
    }
  }

  // ------------------------------------------------------------------ wall run
  wallAt(dir, y) {
    // reaches up to ~0.6 m past your shoulder so you don't have to be scraping the wall
    const px = this.pos[0] + dir[0] * (HW + 0.35), pz = this.pos[2] + dir[1] * (HW + 0.35);
    const ex = dir[0] ? 0.4 : 0.22, ez = dir[1] ? 0.4 : 0.22;
    return this.world.firstOverlap([px - ex, y + 0.5, pz - ez], [px + ex, y + 1.6, pz + ez]);
  }

  tryWallRun(strafe) {
    const hs = this.hSpeed;
    if (this.wallCooldown > 0 || hs < WALLRUN_MIN || this.vel[1] < -7 || this.airTime < 0.08) return false;
    const vx = this.vel[0] / hs, vz = this.vel[2] / hs;
    for (const d of DIRS) {
      const along = d[0] * vx + d[1] * vz;            // how much we're running INTO the wall
      if (along < -0.1 || along > 0.75) continue;      // must be running roughly parallel to it
      const b = this.wallAt(d, this.pos[1]);
      if (!b || b.max[1] < this.pos[1] + 1.7) continue; // too short to run on
      const key = `${d[0]},${d[1]},${(d[0] ? b.min[0] : b.min[2]).toFixed(1)}`;
      if (key === this.lastWall) continue;              // one run per wall until you touch the ground
      // direction along the wall = velocity with the into-wall part removed
      let ax = vx - d[0] * along, az = vz - d[1] * along;
      const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
      const r = [Math.cos(this.yaw), -Math.sin(this.yaw)];
      const side = Math.sign(d[0] * r[0] + d[1] * r[1]) || 1;   // +1 = wall on your right
      this.wallRun = {
        dir: d, a: [ax, az], n: [-d[0], -d[1]], side, t: 0, grav: 4.5,
        speed: clamp(hs * Math.sqrt(1 - along * along) + 0.6, 7.6, 11.5),
      };
      this.lastWall = key;
      this.vel[1] = Math.max(this.vel[1] * 0.35, 3.2);
      this.sliding = false;
      this.wallStepT = 0;
      this.events.push('wallrun');
      return true;
    }
    return false;
  }

  updateWallRun(dt, fwdIn, crouchHit) {
    const w = this.wallRun;
    w.t += dt;
    const still = this.wallAt(w.dir, this.pos[1]);
    if (this.jumpBuffer > 0 && w.t > 0.04) {
      // wall jump: kick off away from the wall, keep most of the run speed
      this.jumpBuffer = 0;
      const sp = w.speed * 0.92;
      this.vel = [w.a[0] * sp + w.n[0] * 6.2, JUMP_V * 1.02, w.a[1] * sp + w.n[1] * 6.2];
      this.wallRun = null;
      this.wallCooldown = 0.22;
      this.slideJumped = true;     // a wall jump into a slide counts for the chain
      this.events.push('walljump');
      return;
    }
    if (!still || w.t > WALLRUN_TIME || fwdIn <= 0 || crouchHit) {
      this.wallRun = null;
      this.wallCooldown = 0.25;
      this.vel[0] += w.n[0] * 1.2;  // peel off the wall
      this.vel[2] += w.n[1] * 1.2;
      return;
    }
    // stick to the wall and keep pace; gravity ramps up toward the end of the run
    w.grav = w.t < WALLRUN_TIME * 0.65 ? 4.5 : 14;
    w.speed = Math.max(w.speed - dt * 0.6, 7);
    this.vel[0] = w.a[0] * w.speed - w.n[0] * 2.5;   // pulled in against the wall
    this.vel[2] = w.a[1] * w.speed - w.n[1] * 2.5;
    this.crouching = false;
    this.height = STAND;
    this.wallStepT -= dt;
    if (this.wallStepT <= 0) { this.wallStepT = 0.17; this.events.push('wallstep'); }
  }

  updateMantle(dt) {
    const m = this.trav;
    m.t += dt;
    const p = Math.min(m.t / m.len, 1);
    // pull up first (fast, then easing in to the top), then roll forward over the lip
    const up = 1 - Math.pow(1 - Math.min(p / 0.6, 1), 2.2);
    const fwd = smoothstep((p - 0.5) / 0.5);
    const np = [
      m.from[0] + (m.to[0] - m.from[0]) * fwd,
      m.from[1] + (m.to[1] - m.from[1]) * up,
      m.from[2] + (m.to[2] - m.from[2]) * fwd,
    ];
    if (dt > 0) this.vel = np.map((c, k) => (c - this.pos[k]) / dt);
    this.pos = np;
    m.p = p;
    this.height = this.overlap(STAND) ? CROUCH : STAND;
    this.crouching = this.height === CROUCH;
    if (p >= 1) {
      this.trav = null;
      this.grounded = true;
      this.vel = [m.dir[0] * m.keep, 0, m.dir[1] * m.keep];
      this.landV -= 0.35;
      this.camPitchV += 0.2;
    }
  }

  // ------------------------------------------------------------------ camera feel
  cameraFeel(dt, strafe) {
    const hs = this.hSpeed;
    const tr = this.trav;
    let eyeTarget = this.crouching ? (this.sliding ? 0.85 : 0.98) : 1.62;
    if (tr?.kind === 'vault') eyeTarget = 1.3;            // tucked, but not crouched
    if (tr?.kind === 'hang') eyeTarget = 1.62;
    if (tr?.kind === 'mantle') {
      eyeTarget = 1.62 - 0.35 * Math.sin(Math.PI * tr.p); // hunch over the lip
      if (this.crouching) eyeTarget = Math.min(eyeTarget, 0.98);
    }
    this.eyeH += (eyeTarget - this.eyeH) * damp(this.sliding ? 16 : tr ? 14 : 12, dt);
    this.stepSmooth *= Math.exp(-12 * dt);

    const bobbing = this.grounded && !this.sliding && !tr && hs > 1;
    this.bobAmt += ((bobbing ? Math.min(hs / 8, 1) : 0) - this.bobAmt) * damp(8, dt);
    if (bobbing) {
      const before = Math.floor(this.bobT / Math.PI);
      this.bobT += dt * hs * 1.25;
      if (Math.floor(this.bobT / Math.PI) !== before) this.events.push('step');
    }

    // lean into strafes, tilt during slides, roll with mantles and vaults
    let rollTarget = -strafe * 0.012 * Math.min(hs / 5, 1);
    if (this.sliding) rollTarget = 0.07;
    let pitchTarget = 0;
    if (tr?.kind === 'mantle') {
      rollTarget = 0.045 * Math.sin(Math.PI * tr.p);
      pitchTarget = -0.13 * Math.sin(Math.PI * Math.min(tr.p * 1.15, 1));
    } else if (tr?.kind === 'vault') {
      const s = Math.sin(Math.PI * tr.p);
      rollTarget = 0.1 * s;
      pitchTarget = -0.08 * s;
    } else if (tr?.kind === 'hang') {
      rollTarget = 0;
      pitchTarget = 0.42 * smoothstep(tr.t / 0.2);      // look up at the lip you're holding
    }
    if (this.wallRun) {
      const w = this.wallRun;
      const inT = smoothstep(w.t / 0.15);
      rollTarget = w.side * 0.14 * inT;                 // tilt away from the wall
    }
    this.roll += (rollTarget - this.roll) * damp(9, dt);
    [this.camPitch, this.camPitchV] = spring(this.camPitch, this.camPitchV, pitchTarget, 150, 19, dt);
    [this.landOff, this.landV] = spring(this.landOff, this.landV, 0, 170, 18, dt);
    this.landOff = clamp(this.landOff, -0.35, 0.15);
  }

  moveAxis(ax, d) {
    if (d === 0) return false;
    this.pos[ax] += d;
    let blocked = false;
    for (let iter = 0; iter < 4; iter++) {
      const b = this.overlap();
      if (!b) return blocked;
      if (ax !== 1) {
        const rise = b.max[1] - this.pos[1];
        if (this.grounded && rise > 0 && rise <= STEP) {
          const oldY = this.pos[1];
          this.pos[1] = b.max[1] + 0.001;
          if (!this.overlap()) { this.stepSmooth -= this.pos[1] - oldY; return blocked; }
          this.pos[1] = oldY;
        }
        this.pos[ax] = d > 0 ? b.min[ax] - HW - 1e-4 : b.max[ax] + HW + 1e-4;
        this.vel[ax] = 0;
        blocked = true;
      } else {
        if (d > 0) {
          this.pos[1] = b.min[1] - this.height - 1e-4;
        } else {
          this.pos[1] = b.max[1];
          this.grounded = true;
        }
        this.vel[1] = 0;
      }
    }
    return blocked;
  }

  eye() {
    const bob = Math.sin(this.bobT * 2) * 0.04 * this.bobAmt;
    return [this.pos[0], this.pos[1] + this.eyeH + this.stepSmooth + this.landOff + bob, this.pos[2]];
  }

  forward(extraPitch = 0, extraYaw = 0) {
    return forwardFrom(this.yaw + extraYaw, clamp(this.pitch + this.camPitch + extraPitch, -1.55, 1.55));
  }
}
