import { Entity } from "./entity.js";
import { ART_SCALE } from "../core/constants.js";

const AGGRO_RANGE = 140 * ART_SCALE;
const TELEGRAPH_TIME = 0.55;
const CHARGE_TIME = 0.85;
const RECOVER_TIME = 1.2;
const CHARGE_SPEED = 210 * ART_SCALE;
const CREEP_SPEED = 26 * ART_SCALE;

const FUR_LIGHT = "#8a6a45";
const FUR_DARK = "#5c4530";
const OUTLINE = "#171310";
const SNOUT = "#2a2018";
const CLAW = "#ece3c9";
const EYE_COLD = "#241a12";
const EYE_HOT = "#ffcf6b";
const BREATH = "rgba(230, 240, 245, 0.6)";

/**
 * A giant short-faced bear that guards the Frozen Pass: idles until the
 * player wanders close, rears up on its hind legs with a roar, then drops
 * back down into a fast charging swipe before recovering (slow, vulnerable)
 * and repeating.
 */
export class Arctodus extends Entity {
  constructor(x, y, maxHealth = 20) {
    super(x, y, 40 * ART_SCALE, 36 * ART_SCALE);
    this.health = maxHealth;
    this.maxHealth = maxHealth;
    this.isBoss = true;
    this.sprite = null;
    this.contactDamage = 1;
    this.guardX = x;
    this.state = "idle";
    this.stateTimer = 0;
    this._facing = -1;
    this._chargeDir = -1;
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
          this._chargeDir = Math.sign(dx) || this._facing;
          this._facing = this._chargeDir;
        }
        break;

      case "telegraph":
        this.contactDamage = 1;
        this.vx = 0;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = "charge";
          this.stateTimer = CHARGE_TIME;
        }
        break;

      case "charge": {
        this.contactDamage = 3;
        this.vx = this._chargeDir * CHARGE_SPEED;
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
    const hot = this.state === "telegraph" || this.state === "charge";
    // Rears up on hind legs while telegraphing, drops back down to charge.
    const rear = this.state === "telegraph" ? Math.min(1, (TELEGRAPH_TIME - this.stateTimer) / TELEGRAPH_TIME) : 0;

    ctx.save();
    ctx.translate(cx, cy - rear * 10);
    if (this._facing < 0) ctx.scale(-1, 1);
    ctx.rotate(-rear * 0.3);

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Cold breath while roaring or charging.
    const puffs = hot ? 3 : 0;
    ctx.fillStyle = BREATH;
    for (let i = 0; i < puffs; i++) {
      const phase = this._animTime * 6 + i * 1.5;
      ctx.beginPath();
      ctx.arc(20 + Math.sin(phase) * 2, -16 - ((phase * 5) % 10), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hind legs.
    const stride = this.state === "charge" ? Math.sin(this._animTime * 24) : 0;
    for (const lx of [-14 + stride * 2, 8 - stride * 2]) {
      ctx.fillStyle = FUR_DARK;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.rect(lx - 6, 4, 12, 20 - rear * 6);
      ctx.fill();
      ctx.stroke();
    }

    // Body: a big, hunched, humped silhouette.
    ctx.fillStyle = FUR_LIGHT;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-22, 8);
    ctx.quadraticCurveTo(-26, -6, -16, -18);
    ctx.quadraticCurveTo(0, -28, 14, -18);
    ctx.quadraticCurveTo(24, -10, 22, 6);
    ctx.quadraticCurveTo(2, 14, -22, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Shoulder hump shading + fur tufts.
    ctx.fillStyle = FUR_DARK;
    ctx.beginPath();
    ctx.ellipse(-6, -14, 12, 8, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Front legs / paws with claws.
    for (const lx of [16, 2]) {
      ctx.fillStyle = FUR_DARK;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.rect(lx - 5, -2 + rear * 6, 10, 16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = CLAW;
      for (const cx2 of [-4, -1, 2]) {
        ctx.beginPath();
        ctx.moveTo(lx + cx2, 14 + rear * 6);
        ctx.lineTo(lx + cx2, 18 + rear * 6);
        ctx.stroke();
      }
    }

    // Head: short, broad snout characteristic of the species.
    ctx.fillStyle = FUR_LIGHT;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(22, -20, 10, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = SNOUT;
    ctx.beginPath();
    ctx.ellipse(29, -17, 5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears.
    ctx.fillStyle = FUR_DARK;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.5;
    for (const ey of [-27, -16]) {
      ctx.beginPath();
      ctx.arc(17, ey, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Eye.
    ctx.fillStyle = hot ? EYE_HOT : EYE_COLD;
    ctx.beginPath();
    ctx.arc(25, -22, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Bared teeth while roaring/charging.
    if (hot) {
      ctx.fillStyle = "#f5f0e0";
      ctx.beginPath();
      ctx.moveTo(30, -14);
      ctx.lineTo(33, -11);
      ctx.lineTo(30, -10);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}
