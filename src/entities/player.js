import { Entity } from "./entity.js";
import { Projectile } from "./projectile.js";
import { applyPlatformPhysics } from "../core/physics.js";
import { ART_SCALE } from "../core/constants.js";

const MOVE_SPEED = 70 * ART_SCALE;
const JUMP_VELOCITY = -160 * ART_SCALE;
const FAST_FALL_ACCEL = 600 * ART_SCALE;

// Z/X/C are three distinct weapons, each with its own fire-rate cooldown.
const WEAPON_COOLDOWNS = { z: 0.22, x: 0.5, c: 0.9 };

export class Player extends Entity {
  constructor(x, y) {
    super(x, y, 12 * ART_SCALE, 16 * ART_SCALE);
    this.facing = "right";
    this.sprite = null; // assign a SpriteSheet once art is available
    this.cooldowns = { z: 0, x: 0, c: 0 };
  }

  update(dt, game) {
    const { input } = game;

    let dx = 0;
    if (input.isDown("left")) dx -= 1;
    if (input.isDown("right")) dx += 1;
    if (dx !== 0) this.facing = dx > 0 ? "right" : "left";

    this.vx = dx * MOVE_SPEED;
    this.x += this.vx * dt;
    this.x = Math.max(0, Math.min(this.x, game.world.width - this.width));

    if (input.isDown("up") && this.grounded) {
      this.vy = JUMP_VELOCITY;
    }
    if (input.isDown("down") && !this.grounded) {
      this.vy += FAST_FALL_ACCEL * dt;
    }

    applyPlatformPhysics(this, dt, game.world);

    for (const key of Object.keys(this.cooldowns)) {
      this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
      if (input.isDown(key) && this.cooldowns[key] === 0) {
        this.shoot(key, game);
        this.cooldowns[key] = WEAPON_COOLDOWNS[key];
      }
    }
  }

  shoot(type, game) {
    const dir = this.facing === "right" ? 1 : -1;
    const originX = this.x + (dir === 1 ? this.width : 0);
    const originY = this.y + this.height / 2 - 1;

    if (type === "z") {
      // Fast, low-damage single shot.
      game.spawnEntity(
        new Projectile(originX, originY, dir * 220 * ART_SCALE, 0, { damage: 1, color: "#fff67a" })
      );
    } else if (type === "x") {
      // Three-way spread.
      for (const spread of [-0.25, 0, 0.25]) {
        const speed = 180 * ART_SCALE;
        game.spawnEntity(
          new Projectile(originX, originY, dir * speed * Math.cos(spread), speed * Math.sin(spread), {
            damage: 1,
            color: "#ff9a3f",
            life: 0.6,
          })
        );
      }
    } else if (type === "c") {
      // Slow heavy shot.
      game.spawnEntity(
        new Projectile(originX, originY, dir * 100 * ART_SCALE, 0, {
          damage: 3,
          color: "#ff4d4d",
          width: 6 * ART_SCALE,
          height: 6 * ART_SCALE,
          life: 1.5,
        })
      );
    }
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

    // Facing indicator, handy for confirming aim direction without art.
    ctx.fillStyle = "#0b0d10";
    const markSize = 3 * ART_SCALE;
    const facingX = this.facing === "right" ? screenX + this.width - markSize : screenX;
    ctx.fillRect(facingX, screenY + markSize, markSize, markSize);
  }
}
