import { FIXED_TIMESTEP, MAX_FRAME_DELTA } from "./constants.js";

export class GameLoop {
  constructor({ update, render }) {
    this.update = update;
    this.render = render;
    this.accumulator = 0;
    this.lastTime = 0;
    this.running = false;
    this.fps = 0;
    this._fpsFrames = 0;
    this._fpsElapsed = 0;

    this._tick = this._tick.bind(this);
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
  }

  _tick(now) {
    if (!this.running) return;

    let delta = now - this.lastTime;
    this.lastTime = now;
    if (delta > MAX_FRAME_DELTA) delta = MAX_FRAME_DELTA;

    this.accumulator += delta;
    while (this.accumulator >= FIXED_TIMESTEP) {
      this.update(FIXED_TIMESTEP / 1000);
      this.accumulator -= FIXED_TIMESTEP;
    }

    this._fpsFrames += 1;
    this._fpsElapsed += delta;
    if (this._fpsElapsed >= 1000) {
      this.fps = this._fpsFrames;
      this._fpsFrames = 0;
      this._fpsElapsed = 0;
    }

    this.render(this.accumulator / FIXED_TIMESTEP);
    requestAnimationFrame(this._tick);
  }
}
