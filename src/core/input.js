const KEY_ALIASES = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "action",
  ShiftLeft: "run",
  ShiftRight: "run",
};

export class Input {
  constructor(target = window) {
    this.pressed = new Set();
    this.justPressed = new Set();

    target.addEventListener("keydown", (e) => {
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

  wasPressed(action) {
    return this.justPressed.has(action);
  }

  endFrame() {
    this.justPressed.clear();
  }
}
