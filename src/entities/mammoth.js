import { Entity } from "./entity.js";
import { applyPlatformPhysics } from "../core/physics.js";
import { ART_SCALE } from "../core/constants.js";

const WANDER_SPEED = 18 * ART_SCALE;
const GAIT_CYCLE = 1.4; // seconds per lumbering stride

const FUR_LIGHT = "#a9835a";
const FUR_DARK = "#7a5a3a";
const OUTLINE = "#171310";
const TUSK = "#ece3c9";
const TRUNK_COLOR = "#8a6a45";
const LEG_COLOR = "#5c4530";
const EYE_COLOR = "#1a1410";

// Traces a smooth closed loop through a ring of control points (each point
// pulls the curve toward it without the polygon's hard corners), so the
// hump and body read as one continuous silhouette instead of stacked shapes.
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

export class Mammoth extends Entity {
  constructor(x, y) {
    super(x, y, 28 * ART_SCALE, 24 * ART_SCALE);
    this.health = 5;
    this.sprite = null;
    this.contactDamage = 1;
    this._wanderDir = Math.random() < 0.5 ? -1 : 1;
    this._wanderTimer = 2 + Math.random() * 3;
    // Randomized so multiple mammoths don't stride in lockstep.
    this._animTime = Math.random() * GAIT_CYCLE;
  }

  update(dt, game) {
    this._wanderTimer -= dt;
    if (this._wanderTimer <= 0) {
      this._wanderDir = Math.random() < 0.5 ? -1 : 1;
      this._wanderTimer = 2 + Math.random() * 3;
    }

    this.vx = this._wanderDir * WANDER_SPEED;
    this.x = Math.max(0, Math.min(this.x + this.vx * dt, game.world.width - this.width));
    this._animTime += dt;

    applyPlatformPhysics(this, dt, game.world);
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
    // -1..1 stride phase drives the leg swing and a slight trunk sway.
    const stride = Math.sin((this._animTime / GAIT_CYCLE) * Math.PI * 2);

    ctx.save();
    ctx.translate(cx, cy);
    // Local +x is always "toward the head"; flip the whole rig to face travel direction.
    if (this._wanderDir < 0) ctx.scale(-1, 1);

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Tail
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-23, 2);
    ctx.quadraticCurveTo(-28, 0, -27, -5);
    ctx.stroke();

    // Legs, drawn first so the body silhouette overlaps their tops.
    const legTop = 6;
    const legBottom = 22;
    const backLegX = -13 + stride * 1.5;
    const frontLegX = 9 - stride * 1.5;
    for (const lx of [backLegX, frontLegX]) {
      ctx.fillStyle = LEG_COLOR;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(lx - 3.5, legTop, 7, legBottom - legTop);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(lx - 3.5, legBottom - 3, 7, 2);
    }

    // Ear, drawn before the body so its base tucks underneath.
    ctx.fillStyle = FUR_DARK;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(9, -11, 5, 6, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Body + humped back as one continuous smoothed silhouette (no seams).
    const bodyPoints = [
      [-24, 6],
      [-13, 16],
      [3, 17],
      [16, 11],
      [18, 1],
      [12, -9],
      [-2, -19],
      [-14, -16],
      [-23, -5],
    ];
    ctx.fillStyle = FUR_LIGHT;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    smoothClosedPath(ctx, bodyPoints);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fur tufts along the humped back.
    ctx.strokeStyle = FUR_DARK;
    ctx.lineWidth = 1.5;
    for (const [tx, ty, a] of [
      [-16, -14, -0.6],
      [-8, -18, -0.3],
      [0, -17, 0.1],
      [-22, -8, -0.8],
    ]) {
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + Math.sin(a) * 4, ty - Math.cos(a) * 4);
      ctx.stroke();
    }

    // Belly shading, inset so it never pokes past the body outline.
    ctx.fillStyle = FUR_DARK;
    ctx.beginPath();
    ctx.ellipse(-4, 10, 15, 5, 0, 0, Math.PI);
    ctx.fill();

    // Head.
    ctx.fillStyle = FUR_LIGHT;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(17, -2, 11, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Eye.
    ctx.fillStyle = EYE_COLOR;
    ctx.beginPath();
    ctx.arc(19, -4, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fefefe";
    ctx.beginPath();
    ctx.arc(19.7, -4.7, 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Trunk: a tapered, gently swaying curve built from shrinking segments.
    // Kept close under the head so it stays clear of the tusks beside it.
    const trunkSway = stride * 1.5;
    const trunkP0 = [20, 5];
    const trunkP1 = [23 + trunkSway, 12];
    const trunkP2 = [18 + trunkSway, 21];
    const quadPoint = (t) => {
      const mt = 1 - t;
      return [
        mt * mt * trunkP0[0] + 2 * mt * t * trunkP1[0] + t * t * trunkP2[0],
        mt * mt * trunkP0[1] + 2 * mt * t * trunkP1[1] + t * t * trunkP2[1],
      ];
    };
    const trunkSamples = [0, 0.34, 0.67, 1].map(quadPoint);
    const trunkWidths = [8, 6, 4.5, 3];
    for (let i = 0; i < trunkSamples.length - 1; i++) {
      const [ax, ay] = trunkSamples[i];
      const [bx, by] = trunkSamples[i + 1];
      const width = (trunkWidths[i] + trunkWidths[i + 1]) / 2;

      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = width + 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();

      ctx.strokeStyle = TRUNK_COLOR;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }

    // Tusks curve outward past the head, away from the trunk beneath them
    // (drawn last so they read on top of everything else).
    ctx.lineCap = "round";
    for (const [start, ctrl, end] of [
      [
        [23, 3],
        [31, -4],
        [36, -9],
      ],
      [
        [23, 6],
        [30, 8],
        [34, 4],
      ],
    ]) {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(start[0], start[1]);
      ctx.quadraticCurveTo(ctrl[0], ctrl[1], end[0], end[1]);
      ctx.stroke();

      ctx.strokeStyle = TUSK;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(start[0], start[1]);
      ctx.quadraticCurveTo(ctrl[0], ctrl[1], end[0], end[1]);
      ctx.stroke();
    }

    ctx.restore();
  }
}
