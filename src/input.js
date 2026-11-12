// Keyboard + mouse state with "pressed this frame" edges.
// Aim and shoot also work from the keyboard (rebindable), for trackpads and one-button mice.
// A click always counts as the trigger being down for the frame it happened in, so a trackpad tap (which
// presses and releases faster than one frame) still fires automatic guns. Trackpad mode makes any click
// shoot (a click with a second finger resting on the pad reads as a right click on many trackpads).
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
    const btn = (e) => (this.trackpad && e.button !== 1 ? 0 : e.button);
    target.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      const b = btn(e);
      this.buttons.add(b);
      this.clicked.add(b);
      if (b === 2) this.aimToggled = !this.aimToggled;
    });
    addEventListener('mouseup', (e) => this.buttons.delete(btn(e)));
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
    return this.buttons.has(2) || this.keys.has(this.binds.aim);
  }
  get fireDown() { return this.buttons.has(0) || this.clicked.has(0) || this.keys.has(this.binds.fire) || this.pressed.has(this.binds.fire); }
  get fireHit() { return this.clicked.has(0) || this.pressed.has(this.binds.fire); }

  endFrame() {
    this.pressed.clear();
    this.clicked.clear();
    this.dx = 0;
    this.dy = 0;
  }

  reset() { this.keys.clear(); this.buttons.clear(); this.aimToggled = false; this.endFrame(); }
}
