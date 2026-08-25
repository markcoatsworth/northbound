import { Entity } from "./entity.js";
import { applyPlatformPhysics } from "../core/physics.js";
import { ART_SCALE } from "../core/constants.js";

const SHAMBLE_SPEED = 24 * ART_SCALE;
const PIXEL = ART_SCALE;
const FRAME_DURATION = 0.35;
const LEG_ROW_START = 10;

// 12x16 pixel-art zombie: matted hair, sickly skin, glowing eyes, tattered
// shirt, ragged hem. Each row mirrors left/right around the body centerline.
const ZOMBIE_ROWS = [
  "..oHHHHHHo..",
  ".oHSSSSSSHo.",
  ".oSESSSSESo.",
  ".oSSSMMSSSo.",
  "..oKCCCCKo..",
  "SSCCCCCCCCSS",
  "S.CCCCCCCC.S",
  "..CCCCCCCC..",
  ".oCKKCCKKCo.",
  ".oK.CKKC.Ko.",
  "..oPPPPPPo..",
  ".oPP.PP.PPo.",
  ".oP.PPPP.Po.",
  "..P.P..P.P..",
  "..o.o..o.o..",
  "...o....o...",
];

const ZOMBIE_PALETTE = {
  H: "#241f1a",
  S: "#7c9b5e",
  E: "#ff3b3b",
  M: "#2a0d0d",
  C: "#4a5240",
  K: "#333a2b",
  P: "#2b2b24",
  o: "#141410",
};

const reverseRow = (row) => row.split("").reverse().join("");

// Frame B alternates the leg pose for a shambling walk cycle.
const ZOMBIE_FRAMES = [
  ZOMBIE_ROWS,
  ZOMBIE_ROWS.map((row, i) => (i >= LEG_ROW_START ? reverseRow(row) : row)),
];

export class Zombie extends Entity {
  constructor(x, y) {
    super(x, y, 12 * ART_SCALE, 16 * ART_SCALE);
    this.health = 1;
    this.sprite = null;
    this.contactDamage = 1;
    // Randomized so multiple zombies don't shamble in lockstep.
    this._animTime = Math.random() * FRAME_DURATION * 2;
  }

  update(dt, game) {
    const dir = Math.sign(game.player.x - this.x);
    this.vx = dir * SHAMBLE_SPEED;
    this.x += this.vx * dt;

    this._animTime += dt;

    applyPlatformPhysics(this, dt, game.world, game.world.enemyPlatforms);
  }

  render(ctx, camera) {
    const screenX = Math.round(this.x - camera.x);
    const screenY = Math.round(this.y - camera.y);

    if (this.sprite) {
      this.sprite.draw(ctx, 0, screenX, screenY);
      return;
    }

    const frameIndex = Math.floor(this._animTime / FRAME_DURATION) % 2;
    const bobY = frameIndex === 1 ? -PIXEL : 0;
    const rows = ZOMBIE_FRAMES[frameIndex];

    for (let row = 0; row < rows.length; row++) {
      const pattern = rows[row];
      for (let col = 0; col < pattern.length; col++) {
        const ch = pattern[col];
        if (ch === ".") continue;
        ctx.fillStyle = ZOMBIE_PALETTE[ch];
        ctx.fillRect(screenX + col * PIXEL, screenY + row * PIXEL + bobY, PIXEL, PIXEL);
      }
    }
  }
}
