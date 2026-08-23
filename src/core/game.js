import { VIEWPORT_WIDTH, VIEWPORT_HEIGHT, PIXEL_SCALE } from "./constants.js";
import { Input } from "./input.js";
import { Camera } from "./camera.js";
import { GameLoop } from "./loop.js";
import { AssetLoader } from "./assetLoader.js";
import { World } from "../world/world.js";
import { Player } from "../entities/player.js";
import { Zombie } from "../entities/zombie.js";
import { Mammoth } from "../entities/mammoth.js";

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;

    canvas.width = VIEWPORT_WIDTH;
    canvas.height = VIEWPORT_HEIGHT;
    canvas.style.width = `${VIEWPORT_WIDTH * PIXEL_SCALE}px`;
    canvas.style.height = `${VIEWPORT_HEIGHT * PIXEL_SCALE}px`;

    this.input = new Input();
    this.assets = new AssetLoader();
    this.camera = new Camera(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
    this.world = new World(60, 40);

    this.player = new Player(this.world.width / 2, this.world.height / 2);
    this.entities = [
      this.player,
      new Zombie(this.player.x - 60, this.player.y - 40),
      new Zombie(this.player.x + 80, this.player.y + 30),
      new Mammoth(this.player.x + 20, this.player.y - 90),
    ];

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: () => this.render(),
    });

    this._fpsEl = document.getElementById("fps");
  }

  async init(assetManifest = {}) {
    if (Object.keys(assetManifest).length > 0) {
      await this.assets.loadAll(assetManifest);
    }
  }

  start() {
    this.loop.start();
  }

  update(dt) {
    for (const entity of this.entities) {
      entity.update(dt, this);
    }
    this.camera.follow(this.player, this.world.width, this.world.height);
    this.input.endFrame();
  }

  render() {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.world.render(ctx, this.camera);

    for (const entity of this.entities) {
      entity.render(ctx, this.camera);
    }

    if (this._fpsEl) {
      this._fpsEl.textContent = `${this.loop.fps} fps`;
    }
  }
}
