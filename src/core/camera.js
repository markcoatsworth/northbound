export class Camera {
  constructor(viewportWidth, viewportHeight) {
    this.x = 0;
    this.y = 0;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  follow(target, worldWidth, worldHeight) {
    this.x = clamp(
      target.x - this.viewportWidth / 2,
      0,
      Math.max(0, worldWidth - this.viewportWidth)
    );
    this.y = clamp(
      target.y - this.viewportHeight / 2,
      0,
      Math.max(0, worldHeight - this.viewportHeight)
    );
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
