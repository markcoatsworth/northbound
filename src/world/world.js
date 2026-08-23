import { TILE_SIZE, ART_SCALE } from "../core/constants.js";

export class World {
  constructor(widthInTiles, heightInTiles) {
    this.widthInTiles = widthInTiles;
    this.heightInTiles = heightInTiles;
    this.width = widthInTiles * TILE_SIZE;
    this.height = heightInTiles * TILE_SIZE;

    const groundHeight = TILE_SIZE * 3;
    this.groundTop = this.height - groundHeight;

    // Placeholder level geometry until a real tilemap/level format lands.
    this.platforms = [
      { x: 0, y: this.groundTop, width: this.width, height: groundHeight },
      { x: 140 * ART_SCALE, y: this.groundTop - 40 * ART_SCALE, width: 60 * ART_SCALE, height: 12 * ART_SCALE },
      { x: 260 * ART_SCALE, y: this.groundTop - 70 * ART_SCALE, width: 60 * ART_SCALE, height: 12 * ART_SCALE },
      { x: 400 * ART_SCALE, y: this.groundTop - 40 * ART_SCALE, width: 70 * ART_SCALE, height: 12 * ART_SCALE },
      { x: 560 * ART_SCALE, y: this.groundTop - 60 * ART_SCALE, width: 60 * ART_SCALE, height: 12 * ART_SCALE },
    ];
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
