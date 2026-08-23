import { Entity } from "./entity.js";
import { applyPlatformPhysics } from "../core/physics.js";
import { ART_SCALE } from "../core/constants.js";

const WANDER_SPEED = 18 * ART_SCALE;

export class Mammoth extends Entity {
  constructor(x, y) {
    super(x, y, 28 * ART_SCALE, 24 * ART_SCALE);
    this.health = 5;
    this.sprite = null;
    this._wanderDir = Math.random() < 0.5 ? -1 : 1;
    this._wanderTimer = 2 + Math.random() * 3;
  }

  update(dt, game) {
    this._wanderTimer -= dt;
    if (this._wanderTimer <= 0) {
      this._wanderDir = Math.random() < 0.5 ? -1 : 1;
      this._wanderTimer = 2 + Math.random() * 3;
    }

    this.vx = this._wanderDir * WANDER_SPEED;
    this.x = Math.max(0, Math.min(this.x + this.vx * dt, game.world.width - this.width));

    applyPlatformPhysics(this, dt, game.world);
  }

  render(ctx, camera) {
    const screenX = Math.round(this.x - camera.x);
    const screenY = Math.round(this.y - camera.y);

    if (this.sprite) {
      this.sprite.draw(ctx, 0, screenX, screenY);
      return;
    }

    ctx.fillStyle = "#c9a26b";
    ctx.fillRect(screenX, screenY, this.width, this.height);
  }
}
