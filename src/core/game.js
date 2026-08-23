import { VIEWPORT_WIDTH, VIEWPORT_HEIGHT, PIXEL_SCALE, ART_SCALE } from "./constants.js";
import { Input } from "./input.js";
import { Camera } from "./camera.js";
import { GameLoop } from "./loop.js";
import { AssetLoader } from "./assetLoader.js";
import { World } from "../world/world.js";
import { Player } from "../entities/player.js";
import { Zombie } from "../entities/zombie.js";
import { Mammoth } from "../entities/mammoth.js";
import { Projectile } from "../entities/projectile.js";

const WORLD_WIDTH_TILES = 300;
const WORLD_HEIGHT_TILES = 14;

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
    this.world = new World(WORLD_WIDTH_TILES, WORLD_HEIGHT_TILES);

    const groundTop = this.world.groundTop;
    this.player = new Player(40 * ART_SCALE, groundTop - 40 * ART_SCALE);
    this.entities = [
      this.player,
      new Zombie(220 * ART_SCALE, groundTop - 20 * ART_SCALE),
      new Zombie(380 * ART_SCALE, groundTop - 20 * ART_SCALE),
      new Mammoth(520 * ART_SCALE, groundTop - 40 * ART_SCALE),
    ];
    this._pending = [];

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

  /** Queues an entity (e.g. a projectile) to be added after the current update pass. */
  spawnEntity(entity) {
    this._pending.push(entity);
  }

  update(dt) {
    for (const entity of this.entities) {
      entity.update(dt, this);
    }

    this._resolveCombat();

    this.entities.push(...this._pending);
    this._pending = [];
    this.entities = this.entities.filter((entity) => entity.alive);

    this.camera.follow(this.player, this.world.width, this.world.height);
    this.input.endFrame();
  }

  _resolveCombat() {
    for (const projectile of this.entities) {
      if (!(projectile instanceof Projectile) || !projectile.alive) continue;

      for (const enemy of this.entities) {
        const isEnemy = enemy instanceof Zombie || enemy instanceof Mammoth;
        if (!isEnemy || !enemy.alive) continue;

        if (projectile.intersects(enemy)) {
          enemy.health -= projectile.damage;
          projectile.alive = false;
          if (enemy.health <= 0) enemy.alive = false;
          break;
        }
      }
    }
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
