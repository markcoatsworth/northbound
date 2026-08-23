import { Entity } from "./entity.js";
import { ART_SCALE } from "../core/constants.js";

const AGGRO_RANGE = 160 * ART_SCALE;
const TELEGRAPH_TIME = 0.4;
const POUNCE_TIME = 0.28;
const POUNCE_SPEED = 380 * ART_SCALE;
const RECOVER_TIME = 1.0;

const FUR_LIGHT = "#c9a06a";
const FUR_DARK = "#8a6a42";
const SPOT = "#5c4530";
const OUTLINE = "#171009";
const FANG = "#f5f0dc";
const EYE_COLD = "#3a2a14";
const EYE_HOT = "#ffcf3d";

/**
 * The final boss guarding Point Zero: the fastest and deadliest predator in
 * the game. Prowls low until the player is in range, crouches into a tight
 * telegraph, then explodes forward in a blindingly fast pounce before
 * recovering (briefly winded, vulnerable) and stalking again.
 */
export class Smilodon extends Entity {
  constructor(x, y, maxHealth = 36) {
    super(x, y, 40 * ART_SCALE, 28 * ART_SCALE);
    this.health = maxHealth;
    this.maxHealth = maxHealth;
    this.isBoss = true;
    this.sprite = null;
    this.contactDamage = 1;
    this.guardX = x;
    this.state = "idle";
    this.stateTimer = 0;
    this._facing = -1;
    this._pounceDir = -1;
    this._animTime = 0;
  }

  update(dt, game) {
    this._animTime += dt;
    this.y = game.world.groundTop - this.height;

    const dx = game.player.x - this.x;
    const dist = Math.abs(dx);

    switch (this.state) {
      case "idle":
        this.contactDamage = 1;
        this.vx = 0;
        if (dist < AGGRO_RANGE) {
          this.state = "telegraph";
          this.stateTimer = TELEGRAPH_TIME;
          this._pounceDir = Math.sign(dx) || this._facing;
          this._facing = this._pounceDir;
        }
        break;

      case "telegraph":
        this.contactDamage = 1;
        this.vx = 0;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = "pounce";
          this.stateTimer = POUNCE_TIME;
        }
        break;

      case "pounce": {
        this.contactDamage = 4;
        this.vx = this._pounceDir * POUNCE_SPEED;
        this.x = Math.max(0, Math.min(this.x + this.vx * dt, game.world.width - this.width));
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = "recover";
          this.stateTimer = RECOVER_TIME;
          this.vx = 0;
        }
        break;
      }

      case "recover": {
        this.contactDamage = 1;
        const back = Math.sign(this.guardX - this.x);
        this.x += back * 30 * ART_SCALE * dt;
        this.vx = back * 30 * ART_SCALE;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = Math.abs(game.player.x - this.x) < AGGRO_RANGE ? "telegraph" : "idle";
          this.stateTimer = TELEGRAPH_TIME;
        }
        break;
      }
    }
  }

  render(ctx, camera) {
    const screenX = Math.round(this.x - camera.x);
    const screenY = Math.round(this.y - camera.y);

    if (this.sprite) {
      this.sprite.draw(ctx, 0, screenX, screenY);
      return;
    }

    const cx = screenX + this.width / 2;
    const cy = screenY + this.height / 2;
    const hot = this.state === "telegraph" || this.state === "pounce";
    // Crouches low and tight while telegraphing, coiled to spring.
    const crouch = this.state === "telegraph" ? Math.min(1, (TELEGRAPH_TIME - this.stateTimer) / TELEGRAPH_TIME) : 0;

    ctx.save();
    ctx.translate(cx, cy + crouch * 6);
    if (this._facing < 0) ctx.scale(-1, 1);

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Tail, flicking with tension.
    const tailFlick = Math.sin(this._animTime * (hot ? 14 : 4)) * 5;
    ctx.strokeStyle = FUR_DARK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-16, 2);
    ctx.quadraticCurveTo(-28, 4 + tailFlick, -32, -6 + tailFlick);
    ctx.stroke();

    // Legs, low and coiled while crouching.
    const stride = this.state === "pounce" ? Math.sin(this._animTime * 30) * 3 : 0;
    for (const lx of [-12 + stride, 4, 12 - stride]) {
      ctx.fillStyle = FUR_DARK;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(lx - 3, 4, 6, 14 - crouch * 5);
      ctx.fill();
      ctx.stroke();
    }

    // Body, low and muscular.
    ctx.fillStyle = FUR_LIGHT;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-20, 6);
    ctx.quadraticCurveTo(-22, -8 - crouch * 2, -8, -12 - crouch * 2);
    ctx.quadraticCurveTo(10, -14 - crouch * 2, 20, -6);
    ctx.quadraticCurveTo(20, 4, 8, 8);
    ctx.quadraticCurveTo(-8, 10, -20, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Rosette spots.
    ctx.strokeStyle = SPOT;
    ctx.lineWidth = 1.5;
    for (const [sx, sy] of [
      [-10, -4],
      [-2, -8],
      [6, -4],
      [-14, 0],
    ]) {
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Head, low and forward while coiled.
    ctx.fillStyle = FUR_LIGHT;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(21, -6 - crouch, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ears.
    ctx.fillStyle = FUR_DARK;
    for (const ey of [-13, -4]) {
      ctx.beginPath();
      ctx.moveTo(16, ey - crouch);
      ctx.lineTo(19, ey - 4 - crouch);
      ctx.lineTo(21, ey - crouch);
      ctx.closePath();
      ctx.fill();
    }

    // Eye.
    ctx.fillStyle = hot ? EYE_HOT : EYE_COLD;
    ctx.beginPath();
    ctx.arc(25, -8 - crouch, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Iconic saber teeth, always visible, gleaming when hot.
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(28, -2 - crouch);
    ctx.lineTo(30, 8 - crouch);
    ctx.stroke();
    ctx.strokeStyle = hot ? "#fffdf0" : FANG;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(28, -2 - crouch);
    ctx.lineTo(30, 8 - crouch);
    ctx.stroke();

    ctx.restore();
  }
}
