import { Entity } from "./entity.js";

const SHAMBLE_SPEED = 24;

export class Zombie extends Entity {
  constructor(x, y) {
    super(x, y, 12, 16);
    this.sprite = null;
  }

  update(dt, game) {
    const target = game.player;
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance > 1) {
      this.vx = (dx / distance) * SHAMBLE_SPEED;
      this.vy = (dy / distance) * SHAMBLE_SPEED;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }
  }

  render(ctx, camera) {
    const screenX = Math.round(this.x - camera.x);
    const screenY = Math.round(this.y - camera.y);

    if (this.sprite) {
      this.sprite.draw(ctx, 0, screenX, screenY);
      return;
    }

    ctx.fillStyle = "#8a3fb3";
    ctx.fillRect(screenX, screenY, this.width, this.height);
  }
}
