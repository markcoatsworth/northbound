import { Entity } from "./entity.js";
import { ART_SCALE } from "../core/constants.js";

const AGGRO_RANGE = 150 * ART_SCALE;
const TELEGRAPH_TIME = 0.55;
const CHARGE_TIME = 0.85;
const RECOVER_TIME = 1.1;
const CHARGE_SPEED = 240 * ART_SCALE;
const CREEP_SPEED = 30 * ART_SCALE;

const CHASSIS_MAIN = "#8a2f22";
const CHASSIS_DARK = "#5c1f17";
const OUTLINE = "#120c0a";
const METAL = "#3a3f45";
const GLASS = "#7fa8b8";
const HEADLIGHT = "#ffe066";
const HEADLIGHT_HOT = "#fff2b0";
const FLAME = "#e8b23f";
const TIRE = "#161616";
const RIM = "#8a8a8a";
const SMOKE = "rgba(180, 180, 180, 0.55)";

/**
 * A boss enemy that guards the far end of a level: it idles until the
 * player wanders into range, telegraphs with an engine-rev shake, then
 * charges in a straight line before recovering (vulnerable, slow) and
 * repeating. Contact damage spikes while charging.
 */
export class MonsterTruck extends Entity {
  constructor(x, y, maxHealth = 16) {
    super(x, y, 40 * ART_SCALE, 24 * ART_SCALE);
    this.health = maxHealth;
    this.maxHealth = maxHealth;
    this.sprite = null;
    this.contactDamage = 1;
    this.guardX = x;
    this.state = "idle";
    this.stateTimer = 0;
    this._facing = -1; // faces the level start, where the player approaches from
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

    let cx = screenX + this.width / 2;
    const cy = screenY + this.height / 2;

    // Engine-rev shake while telegraphing a charge.
    if (this.state === "telegraph") {
      cx += Math.sin(this._animTime * 60) * 1.5;
    }

    ctx.save();
    ctx.translate(cx, cy);
    if (this._facing < 0) ctx.scale(-1, 1);

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Motion streaks behind the truck while charging.
    if (this.state === "charge") {
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      for (const [sy, len] of [
        [-4, 10],
        [2, 14],
        [8, 8],
      ]) {
        ctx.beginPath();
        ctx.moveTo(-34, sy);
        ctx.lineTo(-34 - len, sy);
        ctx.stroke();
      }
    }

    // Exhaust smoke.
    const smokePuffs = this.state === "charge" ? 3 : 1;
    ctx.fillStyle = SMOKE;
    for (let i = 0; i < smokePuffs; i++) {
      const phase = this._animTime * 3 + i * 1.7;
      const puffY = -22 - ((phase * 6) % 12);
      ctx.beginPath();
      ctx.arc(-30 + Math.sin(phase) * 2, puffY, 3 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = METAL;
    ctx.fillRect(-31, -22, 4, 10);

    // Rear wheel, then front wheel (drawn before the body so the chassis overlaps their tops).
    for (const wx of [-17, 13]) {
      ctx.fillStyle = TIRE;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wx, 12, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = RIM;
      ctx.beginPath();
      ctx.arc(wx, 12, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.5;
      for (let a = 0; a < 4; a++) {
        const angle = (this._animTime * (this.state === "charge" ? 14 : 3) + (a * Math.PI) / 2) % (Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(wx, 12);
        ctx.lineTo(wx + Math.cos(angle) * 5, 12 + Math.sin(angle) * 5);
        ctx.stroke();
      }
    }

    // Main chassis.
    ctx.fillStyle = CHASSIS_MAIN;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-28, 8);
    ctx.lineTo(-28, -8);
    ctx.lineTo(-14, -12);
    ctx.lineTo(14, -12);
    ctx.lineTo(22, -2);
    ctx.lineTo(26, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Lower skirt shading.
    ctx.fillStyle = CHASSIS_DARK;
    ctx.beginPath();
    ctx.rect(-28, 2, 54, 6);
    ctx.fill();

    // Flame decal.
    ctx.fillStyle = FLAME;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-10, 6);
    ctx.quadraticCurveTo(-6, -1, -2, 6);
    ctx.quadraticCurveTo(-6, 3, -10, 6);
    ctx.fill();
    ctx.stroke();

    // Roll cage.
    ctx.strokeStyle = METAL;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10, -12);
    ctx.lineTo(-10, -22);
    ctx.lineTo(10, -22);
    ctx.lineTo(10, -12);
    ctx.stroke();

    // Windshield.
    ctx.fillStyle = GLASS;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(12, -11);
    ctx.lineTo(19, -3);
    ctx.lineTo(12, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Spiked front bumper.
    ctx.fillStyle = METAL;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.5;
    for (const spikeY of [-3, 1.5, 6]) {
      ctx.beginPath();
      ctx.moveTo(24, spikeY - 2.5);
      ctx.lineTo(32, spikeY);
      ctx.lineTo(24, spikeY + 2.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Headlights (brighter while revving up).
    const hot = this.state === "telegraph" || this.state === "charge";
    ctx.fillStyle = hot ? HEADLIGHT_HOT : HEADLIGHT;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    for (const ly of [-4, 3]) {
      ctx.beginPath();
      ctx.arc(23, ly, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}
