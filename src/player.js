// First-person movement: walk, sprint, crouch, slide, slide-jump, mantle, air strafe,
// step-up, AABB collision, plus camera feel (bob, lean, landing dip).
import { clamp, damp, forwardFrom } from './math.js';

const HW = 0.3;          // half width of the player box
const STAND = 1.8;
const CROUCH = 1.1;
const STEP = 0.55;       // max height you walk up without jumping
const GRAVITY = 21;
const JUMP_V = 7.4;      // ~1.3m jump
const MANTLE_MAX = 2.15; // highest ledge (above feet) you can climb onto
const SLIDE_MIN = 5.0;   // speed needed to start a slide
const SLIDE_BOOST = 3.6;
const SLIDE_MAX = 13;

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
    this.mantle = null;
    this.eyeH = 1.62;
    this.stepSmooth = 0;
    this.bobT = 0;
    this.bobAmt = 0;
    this.airTime = 0;
    this.events = [];        // 'jump' | 'land' | 'slide' | 'mantle' for sounds/effects
    this.spawnPoint = [0, 0, 0];
    this.spawnYaw = 0;
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
    this.mantle = null;
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

    if (this.mantle) { this.updateMantle(dt); this.cameraFeel(dt, strafe); return; }

    const wasGrounded = this.grounded;
    let hs = this.hSpeed;

    // --- slide: crouch while moving fast (also queues if pressed mid-air) ---
    if (crouchHit && !wasGrounded) this.slideQueued = 0.3;
    this.slideQueued = (this.slideQueued || 0) - dt;
    if ((crouchHit || (this.slideQueued > 0 && crouchHeld)) && wasGrounded && hs > SLIDE_MIN && !this.sliding && this.slideCooldown <= 0) {
      this.sliding = true;
      this.slideQueued = 0;
      this.slideTime = 0;
      this.slideCooldown = 0.6;
      const target = Math.min(hs + SLIDE_BOOST, SLIDE_MAX) / hs;
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

    // --- jump (before friction so bunny-hops / slide-jumps keep their speed) ---
    this.coyote = wasGrounded ? 0.1 : this.coyote - dt;
    let jumped = false;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      if (this.crouching && !this.overlap(STAND)) { this.crouching = false; this.height = STAND; }
      this.vel[1] = JUMP_V;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.sliding = false;
      jumped = true;
      this.events.push('jump');
    }

    // --- horizontal velocity ---
    if (this.sliding && wasGrounded) {
      // slides keep most of their speed for ~0.5s, then bleed off
      const fr = this.slideTime < 0.45 ? 0.35 : 1.8;
      const f = Math.exp(-fr * dt);
      this.vel[0] = this.vel[0] * f + wx * 6 * dt;
      this.vel[2] = this.vel[2] * f + wz * 6 * dt;
    } else if (wasGrounded && !jumped) {
      // overspeed (e.g. just landed from a slide-jump) decays gently instead of snapping
      const over = hs > speed + 0.5 && wl > 0;
      const k = damp(over ? 3.5 : wl > 0 ? 12 : 9, dt);
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

    this.vel[1] -= GRAVITY * dt;
    const fallSpeed = this.vel[1];

    // --- integrate with collision, sub-stepped so fast movement can't tunnel ---
    const maxMove = Math.max(Math.abs(this.vel[0]), Math.abs(this.vel[1]), Math.abs(this.vel[2])) * dt;
    const steps = Math.max(1, Math.ceil(maxMove / 0.2));
    const sdt = dt / steps;
    let blocked = false;
    for (let i = 0; i < steps; i++) {
      blocked = this.moveAxis(0, this.vel[0] * sdt) || blocked;
      blocked = this.moveAxis(2, this.vel[2] * sdt) || blocked;
      this.grounded = false;
      this.moveAxis(1, this.vel[1] * sdt || -0.001);
    }

    this.airTime = this.grounded ? 0 : this.airTime + dt;
    if (this.grounded && !wasGrounded) {
      if (fallSpeed < -5) this.events.push('land');
      if (fallSpeed < -7) this.stepSmooth -= Math.min(0.24, (-fallSpeed - 7) * 0.025 + 0.06);
    }

    // --- mantle: in the air, holding forward, into a ledge you can reach ---
    if (!this.grounded && fwdIn > 0 && this.vel[1] < 4.5 && this.airTime > 0.05) this.tryMantle();

    if (this.pos[1] < -30) this.respawn();
    this.cameraFeel(dt, strafe);
  }

  tryMantle() {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const reach = HW + 0.35;
    const probe = [this.pos[0] + fx * reach, this.pos[2] + fz * reach];
    // find a box right in front of the chest
    const b = this.world.firstOverlap(
      [probe[0] - 0.1, this.pos[1] + 0.3, probe[1] - 0.1],
      [probe[0] + 0.1, this.pos[1] + 1.4, probe[1] + 0.1]);
    if (!b) return;
    const ledge = b.max[1];
    const rise = ledge - this.pos[1];
    if (rise < 0.4 || rise > MANTLE_MAX) return;
    const target = [this.pos[0] + fx * 0.75, ledge + 0.01, this.pos[2] + fz * 0.75];
    if (this.overlap(CROUCH, target)) return;                                  // no room on top
    if (this.overlap(CROUCH, [this.pos[0], ledge + 0.01, this.pos[2]])) return; // no room to climb up
    const keep = Math.min(this.hSpeed, 6);
    this.mantle = { t: 0, len: 0.16 + rise * 0.1, from: [...this.pos], to: target, keep, dir: [fx, fz] };
    this.vel = [0, 0, 0];
    this.sliding = false;
    this.events.push('mantle');
  }

  updateMantle(dt) {
    const m = this.mantle;
    m.t += dt;
    const p = Math.min(m.t / m.len, 1);
    const up = 1 - Math.pow(1 - Math.min(p / 0.7, 1), 2);  // rise first...
    const fwd = Math.max(0, (p - 0.45) / 0.55);              // ...then roll forward
    this.pos[1] = m.from[1] + (m.to[1] - m.from[1]) * up;
    this.pos[0] = m.from[0] + (m.to[0] - m.from[0]) * fwd;
    this.pos[2] = m.from[2] + (m.to[2] - m.from[2]) * fwd;
    this.height = this.overlap(STAND) ? CROUCH : STAND;
    this.crouching = this.height === CROUCH;
    if (p >= 1) {
      this.mantle = null;
      this.grounded = true;
      this.vel = [m.dir[0] * m.keep, 0, m.dir[1] * m.keep];
      this.stepSmooth -= 0.08;
    }
  }

  cameraFeel(dt, strafe) {
    const hs = this.hSpeed;
    this.eyeH += ((this.crouching ? (this.sliding ? 0.85 : 0.98) : 1.62) - this.eyeH) * damp(this.sliding ? 16 : 12, dt);
    this.stepSmooth *= Math.exp(-12 * dt);
    const bobbing = this.grounded && !this.sliding && !this.mantle && hs > 1;
    this.bobAmt += ((bobbing ? Math.min(hs / 8, 1) : 0) - this.bobAmt) * damp(8, dt);
    if (bobbing) this.bobT += dt * hs * 1.25;
    // lean into strafes, tilt during slides, dip on mantles
    let rollTarget = -strafe * 0.012 * Math.min(hs / 5, 1);
    if (this.sliding) rollTarget = 0.07;
    if (this.mantle) rollTarget = 0.04;
    this.roll += (rollTarget - this.roll) * damp(8, dt);
  }

  // returns true if blocked horizontally
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
    return [this.pos[0], this.pos[1] + this.eyeH + this.stepSmooth + bob, this.pos[2]];
  }

  forward(extraPitch = 0, extraYaw = 0) {
    return forwardFrom(this.yaw + extraYaw, clamp(this.pitch + extraPitch, -1.55, 1.55));
  }
}
