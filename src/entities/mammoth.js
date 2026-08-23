import { Entity } from "./entity.js";

const WANDER_SPEED = 18;

export class Mammoth extends Entity {
  constructor(x, y) {
    super(x, y, 28, 24);
    this.sprite = null;
    this._wanderAngle = Math.random() * Math.PI * 2;
    this._wanderTimer = 0;
  }

  update(dt, game) {
    this._wanderTimer -= dt;
    if (this._wanderTimer <= 0) {
      this._wanderAngle = Math.random() * Math.PI * 2;
      this._wanderTimer = 2 + Math.random() * 3;
    }

    this.vx = Math.cos(this._wanderAngle) * WANDER_SPEED;
    this.vy = Math.sin(this._wanderAngle) * WANDER_SPEED;

    this.x = Math.max(0, Math.min(this.x + this.vx * dt, game.world.width - this.width));
    this.y = Math.max(0, Math.min(this.y + this.vy * dt, game.world.height - this.height));
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
