import { TILE_SIZE } from "../core/constants.js";

export class World {
  constructor(widthInTiles, heightInTiles) {
    this.widthInTiles = widthInTiles;
    this.heightInTiles = heightInTiles;
    this.width = widthInTiles * TILE_SIZE;
    this.height = heightInTiles * TILE_SIZE;
  }

  render(ctx, camera) {
    // Placeholder ground grid until a tileset is loaded.
    ctx.fillStyle = "#1a1f26";
    ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    const startX = Math.floor(camera.x / TILE_SIZE) * TILE_SIZE - camera.x;
    const startY = Math.floor(camera.y / TILE_SIZE) * TILE_SIZE - camera.y;

    for (let x = startX; x < camera.viewportWidth; x += TILE_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, camera.viewportHeight);
      ctx.stroke();
    }
    for (let y = startY; y < camera.viewportHeight; y += TILE_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(camera.viewportWidth, y);
      ctx.stroke();
    }
  }
}
