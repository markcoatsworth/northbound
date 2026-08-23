import { Entity } from "./entity.js";

const WALK_SPEED = 60;
const RUN_SPEED = 110;

export class Player extends Entity {
  constructor(x, y) {
    super(x, y, 12, 16);
    this.facing = "down";
    this.sprite = null; // assign a SpriteSheet once art is available
  }

  update(dt, game) {
    const { input } = game;
    const speed = input.isDown("run") ? RUN_SPEED : WALK_SPEED;

    let dx = 0;
    let dy = 0;
    if (input.isDown("left")) dx -= 1;
    if (input.isDown("right")) dx += 1;
    if (input.isDown("up")) dy -= 1;
    if (input.isDown("down")) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const length = Math.hypot(dx, dy);
      dx /= length;
      dy /= length;
      this.facing =
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    }

    this.vx = dx * speed;
    this.vy = dy * speed;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.x = Math.max(0, Math.min(this.x, game.world.width - this.width));
    this.y = Math.max(0, Math.min(this.y, game.world.height - this.height));
  }

  render(ctx, camera) {
    const screenX = Math.round(this.x - camera.x);
    const screenY = Math.round(this.y - camera.y);

    if (this.sprite) {
      this.sprite.draw(ctx, 0, screenX, screenY);
      return;
    }

    // Placeholder art until a sprite sheet is wired up.
    ctx.fillStyle = "#7cff7c";
    ctx.fillRect(screenX, screenY, this.width, this.height);
  }
}
