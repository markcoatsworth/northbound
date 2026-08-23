import { Entity } from "./entity.js";
import { applyPlatformPhysics } from "../core/physics.js";
import { ART_SCALE } from "../core/constants.js";

const SHAMBLE_SPEED = 24 * ART_SCALE;

export class Zombie extends Entity {
  constructor(x, y) {
    super(x, y, 12 * ART_SCALE, 16 * ART_SCALE);
    this.health = 1;
    this.sprite = null;
  }

  update(dt, game) {
    const dir = Math.sign(game.player.x - this.x);
    this.vx = dir * SHAMBLE_SPEED;
    this.x += this.vx * dt;

    applyPlatformPhysics(this, dt, game.world);
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
