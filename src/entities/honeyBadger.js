import { Entity } from "./entity.js";
import { ART_SCALE } from "../core/constants.js";

const AGGRO_RANGE = 150 * ART_SCALE;
const TELEGRAPH_TIME = 0.3;
const LUNGE_TIME = 0.3;
const LUNGE_SPEED = 300 * ART_SCALE;
const RECOVER_TIME = 0.5;
const CREEP_SPEED = 40 * ART_SCALE;

const MANTLE = "#d8d3bf";
const MANTLE_SHADE = "#b3ad96";
const BLACK = "#161410";
const BLACK_SOFT = "#241f18";
const OUTLINE = "#0a0806";
const CLAW = "#ece6d2";
const EYE_COLD = "#1a1410";
const EYE_HOT = "#ffb23d";

/**
 * The final boss guarding Point Zero: a honey badger, scaled up to
 * monstrous size but otherwise exactly as fearless and relentless as the
 * real thing. Barely idles before it's already crouching to attack, lunges
 * hard and fast, and shrugs off the recovery window almost immediately to
 * come again — it does not care how much health it has left.
 */
export class HoneyBadger extends Entity {
  constructor(x, y, maxHealth = 36) {
    super(x, y, 38 * ART_SCALE, 24 * ART_SCALE);
    this.health = maxHealth;
    this.maxHealth = maxHealth;
    this.isBoss = true;
    this.sprite = null;
    this.contactDamage = 1;
    this.guardX = x;
    this.state = "idle";
    this.stateTimer = 0;
    this._facing = -1;
    this._lungeDir = -1;
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
          this._lungeDir = Math.sign(dx) || this._facing;
          this._facing = this._lungeDir;
        }
        break;

      case "telegraph":
        this.contactDamage = 1;
        this.vx = 0;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = "lunge";
          this.stateTimer = LUNGE_TIME;
        }
        break;

      case "lunge": {
        this.contactDamage = 3;
        this.vx = this._lungeDir * LUNGE_SPEED;
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
        this.x += back * CREEP_SPEED * dt;
        this.vx = back * CREEP_SPEED;
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
    const hot = this.state === "telegraph" || this.state === "lunge";
    const crouch = this.state === "telegraph" ? Math.min(1, (TELEGRAPH_TIME - this.stateTimer) / TELEGRAPH_TIME) : 0;

    ctx.save();
    ctx.translate(cx, cy + crouch * 3);
    if (this._facing < 0) ctx.scale(-1, 1);

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Bushy tail, low and dragging, flicking with aggression.
    const tailFlick = Math.sin(this._animTime * (hot ? 16 : 4)) * 4;
    ctx.fillStyle = BLACK;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-16, 4);
    ctx.quadraticCurveTo(-26, 2 + tailFlick, -30, -4 + tailFlick);
    ctx.quadraticCurveTo(-24, 6 + tailFlick, -14, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Squat, powerful legs.
    const stride = this.state === "lunge" ? Math.sin(this._animTime * 28) * 3 : 0;
    for (const lx of [-12 + stride, -2, 8 - stride, 16]) {
      ctx.fillStyle = BLACK;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(lx - 3, 2, 6, 10 - crouch * 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = CLAW;
      for (const cx2 of [-2, 0, 2]) {
        ctx.beginPath();
        ctx.moveTo(lx + cx2, 12 - crouch * 3);
        ctx.lineTo(lx + cx2, 15 - crouch * 3);
        ctx.stroke();
      }
    }

    // Low, stocky body: black underside with the badger's signature pale
    // grey mantle draped over the back.
    ctx.fillStyle = BLACK_SOFT;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-18, 2);
    ctx.quadraticCurveTo(-20, -8 - crouch, 0, -10 - crouch);
    ctx.quadraticCurveTo(16, -9 - crouch, 20, -1);
    ctx.quadraticCurveTo(20, 5, 4, 6);
    ctx.quadraticCurveTo(-10, 7, -18, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // The mantle: a loose cape of pale fur from crown to tail, which is
    // exactly what lets the real animal shrug off bites.
    ctx.fillStyle = MANTLE;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-15, -3 - crouch);
    ctx.quadraticCurveTo(-14, -12 - crouch, 2, -13 - crouch);
    ctx.quadraticCurveTo(15, -12 - crouch, 18, -4 - crouch);
    ctx.quadraticCurveTo(6, -6 - crouch, -4, -6 - crouch);
    ctx.quadraticCurveTo(-11, -6 - crouch, -15, -3 - crouch);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = MANTLE_SHADE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, -9 - crouch);
    ctx.lineTo(6, -9 - crouch);
    ctx.stroke();

    // Head, low and forward, mostly black with a hint of the mantle on the crown.
    ctx.fillStyle = BLACK_SOFT;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(20, -4 - crouch, 8, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = MANTLE;
    ctx.beginPath();
    ctx.ellipse(18, -9 - crouch, 5, 2.5, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Ear.
    ctx.fillStyle = BLACK;
    ctx.beginPath();
    ctx.arc(15, -9 - crouch, 2, 0, Math.PI * 2);
    ctx.fill();

    // Eye.
    ctx.fillStyle = hot ? EYE_HOT : EYE_COLD;
    ctx.beginPath();
    ctx.arc(24, -5 - crouch, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Bared teeth, always ready.
    ctx.fillStyle = CLAW;
    ctx.beginPath();
    ctx.moveTo(26, -1 - crouch);
    ctx.lineTo(29, 1 - crouch);
    ctx.lineTo(26, 2 - crouch);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
