import { Entity } from "./entity.js";
import { Projectile } from "./projectile.js";
import { applyPlatformPhysics } from "../core/physics.js";
import { ART_SCALE } from "../core/constants.js";

const MOVE_SPEED = 70 * ART_SCALE;
const JUMP_VELOCITY = -160 * ART_SCALE;
const FAST_FALL_ACCEL = 600 * ART_SCALE;

// Z/X/C are three distinct weapons, each with its own fire-rate cooldown.
const WEAPON_COOLDOWNS = { z: 0.22, x: 0.5, c: 0.9 };

export const PLAYER_MAX_HEALTH = 5;
const INVULN_TIME = 1.1;
const KNOCKBACK_DISTANCE = 10 * ART_SCALE;
const KNOCKBACK_LIFT = 90 * ART_SCALE;

const PIXEL = ART_SCALE;
const FRAME_DURATION = 0.16;
const LEG_ROW_START = 10;

// 12x16 pixel-art survivor: hair, skin, a blue jacket, denim, boots. Rows
// mirror left/right around the body centerline, same technique as the
// zombie sprite, so the walk cycle can flip just the leg rows.
const PLAYER_ROWS = [
  "..oHHHHHHo..",
  ".oHSSSSSSHo.",
  ".oSESSSSESo.",
  ".oSSSSSSSSo.",
  "..oKJJJJKo..",
  "SSJJJJJJJJSS",
  "S.JJJJJJJJ.S",
  "..JJJJJJJJ..",
  ".oJKKJJKKJo.",
  ".oJ.KJJK.Jo.",
  "..oTTTTTTo..",
  ".oPP.PP.PPo.",
  ".oP.PPPP.Po.",
  "..P.P..P.P..",
  ".oBB.BB.BBo.",
  "..oB....Bo..",
];

const PLAYER_PALETTE = {
  H: "#2e2013",
  S: "#e0a878",
  E: "#1c1712",
  J: "#3a6ea5",
  K: "#274a73",
  T: "#1a1a1a",
  P: "#2a3a4a",
  B: "#141414",
  o: "#0f0c09",
};

const reverseRow = (row) => row.split("").reverse().join("");

// Frame B alternates the leg pose for a walk cycle.
const PLAYER_FRAMES = [
  PLAYER_ROWS,
  PLAYER_ROWS.map((row, i) => (i >= LEG_ROW_START ? reverseRow(row) : row)),
];

export class Player extends Entity {
  constructor(x, y) {
    super(x, y, 12 * ART_SCALE, 16 * ART_SCALE);
    this.facing = "right";
    this.sprite = null; // assign a SpriteSheet once art is available
    this.cooldowns = { z: 0, x: 0, c: 0 };
    this.health = PLAYER_MAX_HEALTH;
    this.maxHealth = PLAYER_MAX_HEALTH;
    this.invulnTimer = 0;
    this._animTime = 0;
    this._walking = false;
  }

  /** Applies damage with a brief invulnerability window and a knockback shove. */
  takeDamage(amount, knockbackDir) {
    if (this.invulnTimer > 0 || this.health <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.invulnTimer = INVULN_TIME;
    this.x += knockbackDir * KNOCKBACK_DISTANCE;
    this.vy = -KNOCKBACK_LIFT;
  }

  update(dt, game) {
    const { input } = game;

    this.invulnTimer = Math.max(0, this.invulnTimer - dt);

    let dx = 0;
    if (input.isDown("left")) dx -= 1;
    if (input.isDown("right")) dx += 1;
    if (dx !== 0) this.facing = dx > 0 ? "right" : "left";

    this.vx = dx * MOVE_SPEED;
    this.x += this.vx * dt;
    this.x = Math.max(0, Math.min(this.x, game.world.width - this.width));
    this._walking = dx !== 0;
    if (this._walking) this._animTime += dt;

    if (input.isDown("up") && this.grounded) {
      this.vy = JUMP_VELOCITY;
      game.audio.jump();
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
      game.audio.shootZ();
      game.spawnEntity(
        new Projectile(originX, originY, dir * 220 * ART_SCALE, 0, { damage: 1, color: "#fff67a" })
      );
    } else if (type === "x") {
      // Three-way spread.
      game.audio.shootX();
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
      game.audio.shootC();
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

    // Blink while invulnerable so a hit reads as feedback, not silence.
    if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 12) % 2 === 0) return;

    if (this.sprite) {
      this.sprite.draw(ctx, 0, screenX, screenY);
      return;
    }

    const frameIndex = this._walking ? Math.floor(this._animTime / FRAME_DURATION) % 2 : 0;
    const rows = PLAYER_FRAMES[frameIndex];

    for (let row = 0; row < rows.length; row++) {
      const pattern = rows[row];
      for (let col = 0; col < pattern.length; col++) {
        const ch = pattern[col];
        if (ch === ".") continue;
        ctx.fillStyle = PLAYER_PALETTE[ch];
        ctx.fillRect(screenX + col * PIXEL, screenY + row * PIXEL, PIXEL, PIXEL);
      }
    }

    // A small sidearm poking out on the facing side, toward the aim direction.
    const gunWidth = 4 * PIXEL;
    const gunY = screenY + 6 * PIXEL;
    const gunX = this.facing === "right" ? screenX + this.width : screenX - gunWidth;
    ctx.fillStyle = "#4a4a4a";
    ctx.fillRect(gunX, gunY, gunWidth, PIXEL);
    ctx.fillStyle = "#0f0c09";
    ctx.fillRect(gunX, gunY, PIXEL, PIXEL);
  }
}
