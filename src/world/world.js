import { TILE_SIZE, ART_SCALE } from "../core/constants.js";

const BUNKER_WIDTH = 4 * TILE_SIZE;
// A one-jump-deep step down (max jump height is ~56px at the current
// gravity/jump-velocity constants), so a bunker is always escapable.
const BUNKER_DEPTH = 20 * ART_SCALE;

export class World {
  constructor(widthInTiles, heightInTiles, bunkerFractions = []) {
    this.widthInTiles = widthInTiles;
    this.heightInTiles = heightInTiles;
    this.width = widthInTiles * TILE_SIZE;
    this.height = heightInTiles * TILE_SIZE;

    const groundHeight = TILE_SIZE * 3;
    this.groundTop = this.height - groundHeight;

    // Ground is built as a run of segments, with a sunken "bunker" segment
    // dropped in wherever a bunker fraction lands — a shallow trench in the
    // main ground the player can drop into and jump back out of.
    this.platforms = [];
    const bunkerCenters = [...bunkerFractions].sort((a, b) => a - b).map((f) => f * this.width);

    let cursor = 0;
    for (const center of bunkerCenters) {
      const gapStart = Math.max(cursor, Math.min(this.width - BUNKER_WIDTH, center - BUNKER_WIDTH / 2));
      if (gapStart <= cursor) continue; // no room left for this bunker; skip it

      this.platforms.push({ x: cursor, y: this.groundTop, width: gapStart - cursor, height: groundHeight });
      this.platforms.push({
        x: gapStart,
        y: this.groundTop + BUNKER_DEPTH,
        width: BUNKER_WIDTH,
        height: groundHeight - BUNKER_DEPTH,
      });
      cursor = gapStart + BUNKER_WIDTH;
    }
    if (cursor < this.width) {
      this.platforms.push({ x: cursor, y: this.groundTop, width: this.width - cursor, height: groundHeight });
    }

    // Placeholder level geometry until a real tilemap/level format lands.
    this.platforms.push(
      { x: 140 * ART_SCALE, y: this.groundTop - 40 * ART_SCALE, width: 60 * ART_SCALE, height: 12 * ART_SCALE },
      { x: 260 * ART_SCALE, y: this.groundTop - 70 * ART_SCALE, width: 60 * ART_SCALE, height: 12 * ART_SCALE },
      { x: 400 * ART_SCALE, y: this.groundTop - 40 * ART_SCALE, width: 70 * ART_SCALE, height: 12 * ART_SCALE },
      { x: 560 * ART_SCALE, y: this.groundTop - 60 * ART_SCALE, width: 60 * ART_SCALE, height: 12 * ART_SCALE }
    );
  }

  render(ctx, camera) {
    ctx.fillStyle = "#1a1f26";
    ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);

    ctx.fillStyle = "#3a2f28";
    for (const platform of this.platforms) {
      ctx.fillRect(
        Math.round(platform.x - camera.x),
        Math.round(platform.y - camera.y),
        platform.width,
        platform.height
      );
    }
  }
}
