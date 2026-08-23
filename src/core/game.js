import { VIEWPORT_WIDTH, VIEWPORT_HEIGHT, PIXEL_SCALE, ART_SCALE } from "./constants.js";
import { Input } from "./input.js";
import { Camera } from "./camera.js";
import { GameLoop } from "./loop.js";
import { AssetLoader } from "./assetLoader.js";
import { World } from "../world/world.js";
import { Player } from "../entities/player.js";
import { Zombie } from "../entities/zombie.js";
import { Mammoth } from "../entities/mammoth.js";
import { MonsterTruck } from "../entities/monsterTruck.js";
import { Arctodus } from "../entities/arctodus.js";
import { Deinosuchus } from "../entities/deinosuchus.js";
import { TRex } from "../entities/tRex.js";
import { Smilodon } from "../entities/smilodon.js";
import { Projectile } from "../entities/projectile.js";
import { LEVELS, WORLD_HEIGHT_TILES } from "./levels.js";

const BOSS_TYPES = {
  monsterTruck: MonsterTruck,
  arctodus: Arctodus,
  deinosuchus: Deinosuchus,
  tRex: TRex,
  smilodon: Smilodon,
};

const LEVEL_CLEAR_DELAY = 1.6;
const BOSS_EDGE_MARGIN = 90 * ART_SCALE;

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

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: () => this.render(),
    });

    this._fpsEl = document.getElementById("fps");

    this.levelIndex = 0;
    this._pending = [];
    this.loadLevel(this.levelIndex);
  }

  loadLevel(index) {
    const level = LEVELS[index];
    this.levelIndex = index;
    this.world = new World(level.widthTiles, WORLD_HEIGHT_TILES, level.bunkerFractions ?? []);

    const groundTop = this.world.groundTop;
    const worldWidth = this.world.width;

    this.player = new Player(40 * ART_SCALE, groundTop - 40 * ART_SCALE);

    const zombies = level.zombieFractions.map(
      (f) => new Zombie(f * worldWidth, groundTop - 20 * ART_SCALE)
    );
    const mammoths = level.mammothFractions.map(
      (f) => new Mammoth(f * worldWidth, groundTop - 40 * ART_SCALE)
    );

    const bossX = worldWidth - BOSS_EDGE_MARGIN;
    const BossClass = BOSS_TYPES[level.bossType];
    this.boss = new BossClass(bossX, groundTop - 24 * ART_SCALE, level.bossHealth);

    this.entities = [this.player, ...zombies, ...mammoths, this.boss];
    this._pending = [];
    this.camera.x = 0;
    this.camera.y = 0;
    this.phase = "playing";
    this.levelClearTimer = 0;
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
    if (this.phase === "gameOver") {
      if (this.input.wasPressed("z") || this.input.wasPressed("up")) {
        this.loadLevel(this.levelIndex);
      }
      this.input.endFrame();
      return;
    }

    if (this.phase === "victory") {
      if (this.input.wasPressed("z") || this.input.wasPressed("up")) {
        this.loadLevel(0);
      }
      this.input.endFrame();
      return;
    }

    if (this.phase === "levelClear") {
      this.levelClearTimer -= dt;
      if (this.levelClearTimer <= 0) {
        if (this.levelIndex + 1 < LEVELS.length) {
          this.loadLevel(this.levelIndex + 1);
        } else {
          this.phase = "victory";
        }
      }
      this.input.endFrame();
      return;
    }

    for (const entity of this.entities) {
      entity.update(dt, this);
    }

    this._resolveCombat();
    this._resolvePlayerContact();

    this.entities.push(...this._pending);
    this._pending = [];
    this.entities = this.entities.filter((entity) => entity.alive);

    this.camera.follow(this.player, this.world.width, this.world.height);
    this.input.endFrame();

    if (this.player.health <= 0) {
      this.phase = "gameOver";
    } else if (!this.boss.alive) {
      this.phase = "levelClear";
      this.levelClearTimer = LEVEL_CLEAR_DELAY;
    }
  }

  _resolveCombat() {
    for (const projectile of this.entities) {
      if (!(projectile instanceof Projectile) || !projectile.alive) continue;

      for (const enemy of this.entities) {
        const isEnemy = enemy instanceof Zombie || enemy instanceof Mammoth || enemy.isBoss;
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

  _resolvePlayerContact() {
    for (const enemy of this.entities) {
      const isThreat = enemy instanceof Zombie || enemy instanceof Mammoth || enemy.isBoss;
      if (!isThreat || !enemy.alive) continue;

      if (enemy.intersects(this.player)) {
        const dir = Math.sign(this.player.x - enemy.x) || (this.player.facing === "right" ? -1 : 1);
        this.player.takeDamage(enemy.contactDamage ?? 1, dir);
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

    this._renderHud();

    if (this.phase !== "playing") {
      this._renderOverlay();
    }

    if (this._fpsEl) {
      this._fpsEl.textContent = `${this.loop.fps} fps`;
    }
  }

  _renderHud() {
    const { ctx } = this;

    // Player health, drawn as small hearts.
    const heartSize = 6;
    for (let i = 0; i < this.player.maxHealth; i++) {
      const hx = 6 + i * (heartSize + 2);
      const hy = 6;
      ctx.fillStyle = i < this.player.health ? "#ff4d4d" : "#3a2020";
      ctx.fillRect(hx, hy, heartSize, heartSize);
      ctx.strokeStyle = "#120c0a";
      ctx.lineWidth = 1;
      ctx.strokeRect(hx + 0.5, hy + 0.5, heartSize - 1, heartSize - 1);
    }

    // Level name, top-right.
    const levelName = LEVELS[this.levelIndex].name;
    ctx.font = "8px monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = "#eafff0";
    ctx.fillText(`LV${this.levelIndex + 1} ${levelName}`, VIEWPORT_WIDTH - 6, 12);

    // Boss health bar, top-center, only while the boss is alive.
    if (this.boss && this.boss.alive) {
      const barWidth = 120;
      const barX = VIEWPORT_WIDTH / 2 - barWidth / 2;
      const barY = 6;
      const pct = Math.max(0, this.boss.health / this.boss.maxHealth);

      ctx.textAlign = "center";
      ctx.fillStyle = "#eafff0";
      ctx.fillText(LEVELS[this.levelIndex].bossName, VIEWPORT_WIDTH / 2, barY - 1);

      ctx.fillStyle = "#3a2020";
      ctx.fillRect(barX, barY + 2, barWidth, 5);
      ctx.fillStyle = "#ff4d4d";
      ctx.fillRect(barX, barY + 2, barWidth * pct, 5);
      ctx.strokeStyle = "#120c0a";
      ctx.lineWidth = 1;
      ctx.strokeRect(barX + 0.5, barY + 2.5, barWidth - 1, 4);
    }

    ctx.textAlign = "left";
  }

  _renderOverlay() {
    const { ctx } = this;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    let title = "";
    let subtitle = "";

    if (this.phase === "gameOver") {
      title = "GAME OVER";
      subtitle = "Press Z to retry";
    } else if (this.phase === "levelClear") {
      title = "LEVEL CLEAR";
      subtitle = LEVELS[this.levelIndex].name;
    } else if (this.phase === "victory") {
      title = "YOU WIN";
      subtitle = "Press Z to play again";
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#eafff0";
    ctx.font = "16px monospace";
    ctx.fillText(title, VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 - 4);
    ctx.font = "8px monospace";
    ctx.fillText(subtitle, VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 12);
    ctx.textAlign = "left";
  }
}
