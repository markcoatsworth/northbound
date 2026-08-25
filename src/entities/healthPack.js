import { Entity } from "./entity.js";
import { applyPlatformPhysics } from "../core/physics.js";
import { ART_SCALE } from "../core/constants.js";

export const HEALTH_PACK_HEAL_AMOUNT = 2;
const PIXEL = ART_SCALE;
const BOB_SPEED = 3;
const BOB_HEIGHT = 2;

// A pickup that rests wherever it's dropped (subject to normal platform
// physics, same as any other entity) and heals the player on contact —
// the payoff for detouring down into a tunnel instead of staying on the
// surface with everyone else.
export class HealthPack extends Entity {
  constructor(x, y) {
    super(x, y, 10 * ART_SCALE, 10 * ART_SCALE);
    this._bobTime = Math.random() * Math.PI * 2;
  }

  update(dt, game) {
    applyPlatformPhysics(this, dt, game.world);
    this._bobTime += dt;

    if (this.intersects(game.player)) {
      game.player.health = Math.min(game.player.maxHealth, game.player.health + HEALTH_PACK_HEAL_AMOUNT);
      this.alive = false;
      game.audio.heal();
    }
  }

  render(ctx, camera) {
    const bobY = Math.sin(this._bobTime * BOB_SPEED) * BOB_HEIGHT;
    const screenX = Math.round(this.x - camera.x);
    const screenY = Math.round(this.y - camera.y + bobY);

    ctx.fillStyle = "#eafff0";
    ctx.fillRect(screenX, screenY, this.width, this.height);
    ctx.strokeStyle = "#120c0a";
    ctx.lineWidth = 1;
    ctx.strokeRect(screenX + 0.5, screenY + 0.5, this.width - 1, this.height - 1);

    ctx.fillStyle = "#ff4d4d";
    ctx.fillRect(screenX + this.width / 2 - PIXEL / 2, screenY + 2 * PIXEL, PIXEL, this.height - 4 * PIXEL);
    ctx.fillRect(screenX + 2 * PIXEL, screenY + this.height / 2 - PIXEL / 2, this.width - 4 * PIXEL, PIXEL);
  }
}
