import { Entity } from "./entity.js";
import { ART_SCALE } from "../core/constants.js";

const AGGRO_RANGE = 110 * ART_SCALE;
const TELEGRAPH_TIME = 0.4;
const LUNGE_TIME = 0.3;
const LUNGE_SPEED = 320 * ART_SCALE;
const RECOVER_TIME = 1.5;
const LUNGE_RANGE = 80 * ART_SCALE;

const HIDE_LIGHT = "#5a6b40";
const HIDE_DARK = "#333f28";
const BELLY = "#c9c39a";
const OUTLINE = "#12140d";
const TOOTH = "#f2ecd8";
const EYE_COLD = "#3a3a20";
const EYE_HOT = "#e6ff5c";
const RIPPLE = "rgba(120, 150, 130, 0.4)";

/**
 * A giant ambush crocodile lurking in the flooded bunker: stays low and
 * still until the player wanders close, then rears up with jaws agape and
 * snaps forward in a short, brutal lunge before sinking back to recover.
 */
export class Deinosuchus extends Entity {
  constructor(x, y, maxHealth = 24) {
    super(x, y, 52 * ART_SCALE, 20 * ART_SCALE);
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
        if (dist < LUNGE_RANGE) {
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
        this.contactDamage = 4;
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
        this.x += back * 20 * ART_SCALE * dt;
        this.vx = back * 20 * ART_SCALE;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = Math.abs(game.player.x - this.x) < LUNGE_RANGE ? "telegraph" : "idle";
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
    // Sits low and flat while idle; rises up as it telegraphs a strike.
    const rise = this.state === "telegraph" ? Math.min(1, (TELEGRAPH_TIME - this.stateTimer) / TELEGRAPH_TIME) : hot ? 1 : 0;

    ctx.save();
    ctx.translate(cx, cy + (1 - rise) * 6);
    if (this._facing < 0) ctx.scale(-1, 1);

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Ripples while lurking low, unsettled by the tail.
    if (this.state === "idle") {
      ctx.strokeStyle = RIPPLE;
      ctx.lineWidth = 1;
      const rippleR = 4 + ((this._animTime * 6) % 10);
      ctx.beginPath();
      ctx.ellipse(-20, 8, rippleR, rippleR * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Tail, whipping side to side.
    const tailSwing = Math.sin(this._animTime * (this.state === "lunge" ? 20 : 3)) * 4;
    ctx.fillStyle = HIDE_DARK;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-18, 2);
    ctx.quadraticCurveTo(-32, 4 + tailSwing, -40, -2 + tailSwing);
    ctx.lineTo(-38, 3 + tailSwing);
    ctx.quadraticCurveTo(-30, 8 + tailSwing, -18, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Stubby legs.
    for (const lx of [-8, 6]) {
      ctx.fillStyle = HIDE_DARK;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(lx - 3, 4, 8, 6);
      ctx.fill();
      ctx.stroke();
    }

    // Body, long and low.
    ctx.fillStyle = HIDE_LIGHT;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-18, 6);
    ctx.quadraticCurveTo(-14, -6 - rise * 4, 4, -6 - rise * 6);
    ctx.quadraticCurveTo(16, -5 - rise * 4, 18, 2);
    ctx.quadraticCurveTo(4, 8, -18, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bony back ridges.
    ctx.fillStyle = HIDE_DARK;
    for (let i = 0; i < 4; i++) {
      const rx = -12 + i * 8;
      ctx.beginPath();
      ctx.moveTo(rx, -6 - rise * 5);
      ctx.lineTo(rx + 3, -11 - rise * 5);
      ctx.lineTo(rx + 6, -6 - rise * 5);
      ctx.closePath();
      ctx.fill();
    }

    // Belly.
    ctx.fillStyle = BELLY;
    ctx.beginPath();
    ctx.ellipse(-2, 5, 12, 3, 0, 0, Math.PI);
    ctx.fill();

    // Long jaw, opening wide while hot.
    const jawOpen = hot ? 8 : 1.5;
    ctx.save();
    ctx.translate(16, -2 - rise * 4);

    // Lower jaw.
    ctx.fillStyle = HIDE_LIGHT;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, jawOpen);
    ctx.lineTo(22, jawOpen + 1);
    ctx.lineTo(18, jawOpen - 1);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = TOOTH;
    for (let i = 0; i < 4; i++) {
      const tx = 4 + i * 4.5;
      ctx.beginPath();
      ctx.moveTo(tx, jawOpen);
      ctx.lineTo(tx + 1.5, jawOpen - 3);
      ctx.lineTo(tx + 3, jawOpen);
      ctx.closePath();
      ctx.fill();
    }

    // Upper jaw / snout.
    ctx.fillStyle = HIDE_LIGHT;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(24, -jawOpen - 1);
    ctx.lineTo(20, -jawOpen + 1);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = TOOTH;
    for (let i = 0; i < 4; i++) {
      const tx = 4 + i * 4.5;
      ctx.beginPath();
      ctx.moveTo(tx, -jawOpen);
      ctx.lineTo(tx + 1.5, -jawOpen + 3);
      ctx.lineTo(tx + 3, -jawOpen);
      ctx.closePath();
      ctx.fill();
    }

    // Eye, raised on a brow.
    ctx.fillStyle = hot ? EYE_HOT : EYE_COLD;
    ctx.beginPath();
    ctx.arc(4, -6 - rise * 4, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore();
  }
}
