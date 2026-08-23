export class AssetLoader {
  constructor() {
    this.images = new Map();
  }

  async loadImage(key, src) {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      image.src = src;
    });
    this.images.set(key, img);
    return img;
  }

  async loadAll(manifest) {
    const entries = Object.entries(manifest);
    await Promise.all(entries.map(([key, src]) => this.loadImage(key, src)));
  }

  get(key) {
    return this.images.get(key);
  }
}
