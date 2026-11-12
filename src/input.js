// Keyboard + mouse state with "pressed this frame" edges.
// Aim and shoot also work from the keyboard (rebindable), for trackpads and one-button mice.
// A click always counts as the trigger being down for the frame it happened in, so a trackpad tap (which
// presses and releases faster than one frame) still fires automatic guns. A quick right click (a two-finger
// tap on a trackpad, which lets go straight away) latches aim on until the next right click; holding the
// right button aims while it's held. In trackpad mode every right click just toggles aim.
export class Input {
  constructor(target) {
    this.keys = new Set();
    this.pressed = new Set();
    this.buttons = new Set();
    this.clicked = new Set();
    this.dx = 0;
    this.dy = 0;
    this.enabled = false;
    this.binds = { aim: 'KeyV', fire: 'KeyF' };
    this.aimMode = 'hold';   // 'hold' | 'toggle'
    this.aimToggled = false;
    this.trackpad = false;
    this.aimLatch = false;      // aim latched on by a quick right tap
    this.rAt = -1e9; this.rUnlatch = false;

    addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (['Space', 'Tab', 'ControlLeft', 'KeyC', this.binds.aim, this.binds.fire].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) {
        this.pressed.add(e.code);
        if (e.code === this.binds.aim) this.aimToggled = !this.aimToggled;
      }
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.buttons.clear(); });
    const rightDown = () => {
      this.aimToggled = !this.aimToggled;
      this.rAt = performance.now();
      if (this.trackpad) { this.aimLatch = !this.aimLatch; this.rUnlatch = true; return; }
      this.rUnlatch = this.aimLatch;        // this press turns a latched aim off
      this.aimLatch = false;
    };
    target.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      const b = e.button;
      this.buttons.add(b);
      this.clicked.add(b);
      if (b === 2) rightDown();
    });
    addEventListener('mouseup', (e) => {
      this.buttons.delete(e.button);
      if (e.button === 2) this.rUp = performance.now();
      // a quick tap: keep aiming until the next right click
      if (e.button === 2 && !this.rUnlatch && performance.now() - this.rAt < 260) this.aimLatch = true;
    });
    // some trackpads send a two-finger tap as only a context-menu event (no mousedown)
    addEventListener('contextmenu', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      if (performance.now() - this.rAt > 300 && performance.now() - (this.rUp || -1e9) > 300) { this.rAt = performance.now(); this.aimToggled = !this.aimToggled; this.aimLatch = !this.aimLatch; }
    });
    addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      // ignore the giant spikes some browsers send when pointer lock engages
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  mouse(b) { return this.buttons.has(b); }
  mouseHit(b) { return this.clicked.has(b); }

  get aiming() {
    if (this.aimMode === 'toggle') return this.aimToggled;
    return this.aimLatch || (!this.trackpad && this.buttons.has(2)) || this.keys.has(this.binds.aim);
  }
  get fireDown() { return this.buttons.has(0) || this.clicked.has(0) || this.keys.has(this.binds.fire) || this.pressed.has(this.binds.fire); }
  get fireHit() { return this.clicked.has(0) || this.pressed.has(this.binds.fire); }

  endFrame() {
    this.pressed.clear();
    this.clicked.clear();
    this.dx = 0;
    this.dy = 0;
  }

  reset() { this.keys.clear(); this.buttons.clear(); this.aimToggled = false; this.aimLatch = false; this.endFrame(); }
}
