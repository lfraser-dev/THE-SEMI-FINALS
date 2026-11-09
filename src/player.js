// First-person movement: walk, sprint, crouch, slide, jump, step-up, AABB collision.
import { clamp, damp, forwardFrom } from './math.js';

const HW = 0.3;          // half width of the player box
const STAND = 1.8;
const CROUCH = 1.1;
const STEP = 0.55;       // max height you walk up without jumping
const GRAVITY = 20;
const JUMP_V = 7.2;      // ~1.3m jump

export const SPEED = { walk: 5.4, sprint: 8.2, crouch: 2.9, ads: 3.4 };

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = [0, 0, 0];
    this.vel = [0, 0, 0];
    this.yaw = 0;
    this.pitch = 0;
    this.height = STAND;
    this.grounded = false;
    this.crouching = false;
    this.sliding = false;
    this.sprinting = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.slideCooldown = 0;
    this.eyeH = 1.62;
    this.stepSmooth = 0;
    this.bobT = 0;
    this.bobAmt = 0;
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
  }

  get hSpeed() { return Math.hypot(this.vel[0], this.vel[2]); }

  overlap(h = this.height) {
    const p = this.pos;
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
    const wasGrounded = this.grounded;
    this.slideCooldown -= dt;

    // --- crouch / slide ---
    let hs = this.hSpeed;
    if (crouchHit && wasGrounded && hs > 6.2 && this.slideCooldown <= 0) {
      this.sliding = true;
      this.slideCooldown = 0.9;
      const boost = Math.min(hs + 3.2, 12.5) / hs;
      this.vel[0] *= boost;
      this.vel[2] *= boost;
    }
    if (crouchHeld) {
      this.crouching = true;
    } else if (this.crouching && !this.overlap(STAND)) {
      this.crouching = false;
    }
    if (!crouchHeld || this.hSpeed < 3.6) this.sliding = false;
    this.height = this.crouching ? CROUCH : STAND;

    this.sprinting = input.down('ShiftLeft') && fwdIn > 0 && !this.crouching && !ads && !firing;
    let speed = this.crouching ? SPEED.crouch : this.sprinting ? SPEED.sprint : SPEED.walk;
    if (ads) speed = Math.min(speed, SPEED.ads);

    // --- horizontal velocity ---
    if (this.sliding && wasGrounded) {
      const f = Math.exp(-1.1 * dt);
      this.vel[0] = this.vel[0] * f + wx * 5 * dt;
      this.vel[2] = this.vel[2] * f + wz * 5 * dt;
    } else if (wasGrounded) {
      const k = damp(wl > 0 ? 13 : 10, dt);
      this.vel[0] += (wx * speed - this.vel[0]) * k;
      this.vel[2] += (wz * speed - this.vel[2]) * k;
    } else {
      const before = this.hSpeed;
      this.vel[0] += wx * 14 * dt;
      this.vel[2] += wz * 14 * dt;
      const cap = Math.max(before, speed), now = this.hSpeed;
      if (now > cap) { this.vel[0] *= cap / now; this.vel[2] *= cap / now; }
    }

    // --- jump ---
    if (input.hit('Space')) this.jumpBuffer = 0.12;
    this.jumpBuffer -= dt;
    this.coyote = wasGrounded ? 0.1 : this.coyote - dt;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vel[1] = JUMP_V;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.sliding = false;
    }

    this.vel[1] -= GRAVITY * dt;
    const fallSpeed = this.vel[1];

    // --- integrate with collision, sub-stepped so fast movement can't tunnel ---
    const maxMove = Math.max(Math.abs(this.vel[0]), Math.abs(this.vel[1]), Math.abs(this.vel[2])) * dt;
    const steps = Math.max(1, Math.ceil(maxMove / 0.2));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.moveAxis(0, this.vel[0] * sdt);
      this.moveAxis(2, this.vel[2] * sdt);
      this.grounded = false;
      // when vertical speed is 0 (already landed this frame) probe 1mm down so we stay grounded
      this.moveAxis(1, this.vel[1] * sdt || -0.001);
    }

    if (this.grounded && !wasGrounded && fallSpeed < -7) {
      this.stepSmooth -= Math.min(0.22, (-fallSpeed - 7) * 0.025 + 0.06); // landing dip
    }

    if (this.pos[1] < -30) this.respawn();

    // --- camera feel ---
    this.eyeH += ((this.crouching ? 0.98 : 1.62) - this.eyeH) * damp(12, dt);
    this.stepSmooth *= Math.exp(-12 * dt);
    hs = this.hSpeed;
    const bobbing = this.grounded && !this.sliding && hs > 1;
    this.bobAmt += ((bobbing ? Math.min(hs / 8, 1) : 0) - this.bobAmt) * damp(8, dt);
    if (bobbing) this.bobT += dt * hs * 1.25;
  }

  moveAxis(ax, d) {
    if (d === 0) return;
    this.pos[ax] += d;
    for (let iter = 0; iter < 4; iter++) {
      const b = this.overlap();
      if (!b) return;
      if (ax !== 1) {
        // try stepping up onto low ledges
        const rise = b.max[1] - this.pos[1];
        if (this.grounded && rise > 0 && rise <= STEP) {
          const oldY = this.pos[1];
          this.pos[1] = b.max[1] + 0.001;
          if (!this.overlap()) { this.stepSmooth -= this.pos[1] - oldY; return; }
          this.pos[1] = oldY;
        }
        this.pos[ax] = d > 0 ? b.min[ax] - HW - 1e-4 : b.max[ax] + HW + 1e-4;
        this.vel[ax] = 0;
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
  }

  eye() {
    const bob = Math.sin(this.bobT * 2) * 0.04 * this.bobAmt;
    return [this.pos[0], this.pos[1] + this.eyeH + this.stepSmooth + bob, this.pos[2]];
  }

  forward(extraPitch = 0, extraYaw = 0) {
    return forwardFrom(this.yaw + extraYaw, clamp(this.pitch + extraPitch, -1.55, 1.55));
  }
}
