import { Entity } from "./entity.js";
import { ART_SCALE } from "../core/constants.js";

export class Projectile extends Entity {
  constructor(x, y, vx, vy, opts = {}) {
    super(x, y, opts.width ?? 4 * ART_SCALE, opts.height ?? 2 * ART_SCALE);
    this.vx = vx;
    this.vy = vy;
    this.damage = opts.damage ?? 1;
    this.color = opts.color ?? "#fff67a";
    this.life = opts.life ?? 1.2;
  }

  update(dt, game) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;

    if (this.life <= 0 || this.x < -this.width || this.x > game.world.width) {
      this.alive = false;
    }
  }

  render(ctx, camera) {
    ctx.fillStyle = this.color;
    ctx.fillRect(
      Math.round(this.x - camera.x),
      Math.round(this.y - camera.y),
      this.width,
      this.height
    );
  }
}
