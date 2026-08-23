import { Entity } from "./entity.js";
import { ART_SCALE } from "../core/constants.js";

const AGGRO_RANGE = 170 * ART_SCALE;
const STALK_SPEED = 34 * ART_SCALE;
const TELEGRAPH_TIME = 0.6;
const BITE_TIME = 0.35;
const BITE_SPEED = 300 * ART_SCALE;
const RECOVER_TIME = 1.3;
const BITE_RANGE = 90 * ART_SCALE;

const HIDE_LIGHT = "#5c5a30";
const HIDE_DARK = "#37361c";
const BELLY = "#c9c39a";
const OUTLINE = "#100f08";
const TOOTH = "#f2ecd8";
const EYE_COLD = "#241f10";
const EYE_HOT = "#ff5c3d";
const GLOW = "rgba(255, 92, 61, 0.35)";

// Traces a smooth closed loop through a ring of control points so the body,
// neck and head read as one continuous silhouette instead of stacked shapes.
function smoothClosedPath(ctx, points) {
  const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = midpoint(points[points.length - 1], points[0]);
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const mid = midpoint(current, next);
    ctx.quadraticCurveTo(current[0], current[1], mid[0], mid[1]);
  }
}

/**
 * The apex predator of Last Stand: stalks toward the player once they're in
 * range, then telegraphs a roar before snapping forward in a fast biting
 * lunge and recovering (a heavy, stomping stagger, vulnerable) to repeat.
 */
export class TRex extends Entity {
  constructor(x, y, maxHealth = 30) {
    super(x, y, 46 * ART_SCALE, 50 * ART_SCALE);
    this.health = maxHealth;
    this.maxHealth = maxHealth;
    this.isBoss = true;
    this.sprite = null;
    this.contactDamage = 1;
    this.guardX = x;
    this.state = "idle";
    this.stateTimer = 0;
    this._facing = -1;
    this._biteDir = -1;
    this._animTime = 0;
  }

  update(dt, game) {
    this._animTime += dt;
    this.y = game.world.groundTop - this.height;

    const dx = game.player.x - this.x;
    const dist = Math.abs(dx);
    if (dist > 4 && (this.state === "idle" || this.state === "stalk")) this._facing = Math.sign(dx);

    switch (this.state) {
      case "idle":
        this.contactDamage = 1;
        this.vx = 0;
        if (dist < AGGRO_RANGE) this.state = "stalk";
        break;

      case "stalk":
        this.contactDamage = 1;
        if (dist < BITE_RANGE) {
          this.state = "telegraph";
          this.stateTimer = TELEGRAPH_TIME;
          this.vx = 0;
        } else if (dist > AGGRO_RANGE * 1.3) {
          this.state = "idle";
        } else {
          this.vx = this._facing * STALK_SPEED;
          this.x = Math.max(0, Math.min(this.x + this.vx * dt, game.world.width - this.width));
        }
        break;

      case "telegraph":
        this.contactDamage = 1;
        this.vx = 0;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = "bite";
          this.stateTimer = BITE_TIME;
          this._biteDir = this._facing;
        }
        break;

      case "bite": {
        this.contactDamage = 4;
        this.vx = this._biteDir * BITE_SPEED;
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
        this.vx = 0;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = Math.abs(game.player.x - this.x) < AGGRO_RANGE ? "stalk" : "idle";
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
    const hot = this.state === "telegraph" || this.state === "bite";
    // Pulls its head/neck back while telegraphing, then thrusts forward to bite.
    const pullBack = this.state === "telegraph" ? Math.min(1, (TELEGRAPH_TIME - this.stateTimer) / TELEGRAPH_TIME) : 0;
    const thrust = this.state === "bite" ? 1 : 0;
    const reach = thrust * 6 - pullBack * 5;

    ctx.save();
    ctx.translate(cx, cy + pullBack * 3);
    if (this._facing < 0) ctx.scale(-1, 1);

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Ferocity glow while roaring/biting.
    if (hot) {
      ctx.fillStyle = GLOW;
      ctx.beginPath();
      ctx.arc(30 + reach, -30, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tail, counterbalancing the stride, trailing behind.
    const stride = this.state === "stalk" || this.state === "bite" ? Math.sin(this._animTime * 12) : 0;
    ctx.fillStyle = HIDE_DARK;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-16, 2);
    ctx.quadraticCurveTo(-36, 0 - stride * 4, -46, -14 - stride * 4);
    ctx.lineTo(-42, -8 - stride * 4);
    ctx.quadraticCurveTo(-30, 8, -16, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Powerful hind legs.
    for (const lx of [-6 + stride * 2, 8 - stride * 2]) {
      ctx.fillStyle = HIDE_DARK;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(lx - 7, 8, 14, 26 - pullBack * 6);
      ctx.fill();
      ctx.stroke();
    }

    // Body, neck and head as one continuous silhouette curving up into the
    // snout, so the head reads as part of the animal rather than a
    // separately floating shape.
    const headX = 30 + reach;
    const headY = -34 - reach * 0.4;
    const bodyPoints = [
      [-16, 10],
      [-8, -8],
      [2, -20],
      [12, -26],
      [headX - 12, headY + 8],
      [headX, headY],
      [headX + 10, headY + 6],
      [headX + 4, headY + 14],
      [14, -4],
      [4, 8],
    ];
    ctx.fillStyle = HIDE_LIGHT;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    smoothClosedPath(ctx, bodyPoints);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Belly.
    ctx.fillStyle = BELLY;
    ctx.beginPath();
    ctx.ellipse(0, 2, 13, 6, 0.2, 0, Math.PI);
    ctx.fill();

    // Underside jaw line + teeth along the snout, always bared.
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(headX - 8, headY + 9);
    ctx.lineTo(headX + 8, headY + 6);
    ctx.stroke();
    ctx.fillStyle = TOOTH;
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const tx = headX - 8 + t * 16;
      const ty = headY + 9 - t * 3;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + 1.5, ty + 3.5);
      ctx.lineTo(tx + 3, ty);
      ctx.closePath();
      ctx.fill();
    }

    // Tiny forearms tucked at the chest.
    for (const ay of [-2, 3]) {
      ctx.fillStyle = HIDE_DARK;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(10, ay, 6, 3);
      ctx.fill();
      ctx.stroke();
    }

    // Eye.
    ctx.fillStyle = hot ? EYE_HOT : EYE_COLD;
    ctx.beginPath();
    ctx.arc(headX - 4, headY + 3, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
