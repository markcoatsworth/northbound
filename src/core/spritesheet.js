export class SpriteSheet {
  constructor(image, frameWidth, frameHeight) {
    this.image = image;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.columns = Math.floor(image.width / frameWidth);
  }

  draw(ctx, frameIndex, x, y) {
    const col = frameIndex % this.columns;
    const row = Math.floor(frameIndex / this.columns);
    ctx.drawImage(
      this.image,
      col * this.frameWidth,
      row * this.frameHeight,
      this.frameWidth,
      this.frameHeight,
      Math.round(x),
      Math.round(y),
      this.frameWidth,
      this.frameHeight
    );
  }
}

export class Animation {
  constructor(frames, frameDuration) {
    this.frames = frames;
    this.frameDuration = frameDuration;
    this.elapsed = 0;
    this.currentIndex = 0;
  }

  update(dt) {
    this.elapsed += dt;
    while (this.elapsed >= this.frameDuration) {
      this.elapsed -= this.frameDuration;
      this.currentIndex = (this.currentIndex + 1) % this.frames.length;
    }
  }

  get frame() {
    return this.frames[this.currentIndex];
  }

  reset() {
    this.elapsed = 0;
    this.currentIndex = 0;
  }
}
