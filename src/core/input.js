const KEY_ALIASES = {
  ArrowUp: "up",
  KeyW: "up",
  Space: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  KeyZ: "z",
  KeyX: "x",
  KeyC: "c",
};

export class Input {
  constructor(target = window) {
    this.pressed = new Set();
    this.justPressed = new Set();
    this.enabled = true;

    target.addEventListener("keydown", (e) => {
      if (!this.enabled) return;
      const action = KEY_ALIASES[e.code];
      if (!action) return;
      if (!this.pressed.has(action)) this.justPressed.add(action);
      this.pressed.add(action);
    });

    target.addEventListener("keyup", (e) => {
      const action = KEY_ALIASES[e.code];
      if (!action) return;
      this.pressed.delete(action);
    });

    target.addEventListener("blur", () => {
      this.pressed.clear();
    });
  }

  isDown(action) {
    return this.pressed.has(action);
  }

  /**
   * Suspends action-key handling — used while something else (e.g. the
   * name-entry screen) owns raw keyboard input — and clears any held/queued
   * actions so nothing typed while suspended leaks in once re-enabled.
   */
  disable() {
    this.enabled = false;
    this.pressed.clear();
    this.justPressed.clear();
  }

  enable() {
    this.enabled = true;
  }

  /**
   * Among the given actions, returns whichever one has been held the
   * longest without interruption (i.e. was pressed first and never
   * released) — Sets iterate in insertion order, and press()/isDown() only
   * add an action once per press, so this "just works" off that ordering.
   * Returns null if none of them are currently held.
   */
  firstHeld(actions) {
    for (const action of this.pressed) {
      if (actions.includes(action)) return action;
    }
    return null;
  }

  wasPressed(action) {
    return this.justPressed.has(action);
  }

  endFrame() {
    this.justPressed.clear();
  }

  /** Wires an on-screen button element to press/release the same action set as the keyboard. */
  bindButton(element, action) {
    const press = (e) => {
      e.preventDefault();
      if (!this.enabled) return;
      if (!this.pressed.has(action)) this.justPressed.add(action);
      this.pressed.add(action);
    };
    const release = (e) => {
      e.preventDefault();
      this.pressed.delete(action);
    };

    element.addEventListener("pointerdown", press);
    element.addEventListener("pointerup", release);
    element.addEventListener("pointerleave", release);
    element.addEventListener("pointercancel", release);
    element.addEventListener("contextmenu", (e) => e.preventDefault());
  }
}
