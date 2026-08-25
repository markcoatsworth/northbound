import { VIEWPORT_WIDTH, VIEWPORT_HEIGHT, PIXEL_SCALE, ART_SCALE, TILE_SIZE } from "./constants.js";
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
import { HoneyBadger } from "../entities/honeyBadger.js";
import { Projectile } from "../entities/projectile.js";
import { LEVELS, WORLD_HEIGHT_TILES, generateLevelLayout, TOTAL_DISTANCE_KM } from "./levels.js";
import { AudioManager } from "./audio.js";
import { loadLeaderboard, saveScore, formatEntryDate } from "./leaderboard.js";

const BOSS_TYPES = {
  monsterTruck: MonsterTruck,
  arctodus: Arctodus,
  deinosuchus: Deinosuchus,
  tRex: TRex,
  honeyBadger: HoneyBadger,
};

const LEVEL_CLEAR_DELAY = 1.6;
const BOSS_EDGE_MARGIN = 90 * ART_SCALE;

// Points awarded during a run. Level-clear bonus scales with level index so
// reaching further north is worth more than farming early kills.
const SCORE = {
  zombieKill: 50,
  mammothKill: 150,
  bossKill: 1000,
  levelClearBonus: 500,
};

const NAME_MAX_LENGTH = 8;
const NAME_LETTERS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const LEADERBOARD_DISPLAY_ROWS = 10;

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
    this.audio = new AudioManager();
    this.camera = new Camera(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: () => this.render(),
    });

    this._fpsEl = document.getElementById("fps");

    this.score = 0;
    this.leaderboard = loadLeaderboard();
    this._resultPhase = null;
    this._name = Array(NAME_MAX_LENGTH).fill(" ");
    this._nameCursor = 0;
    this._lastSavedEntry = null;

    this.levelIndex = 0;
    this._pending = [];
    this.loadLevel(this.levelIndex);
  }

  loadLevel(index) {
    const level = LEVELS[index];
    const layout = generateLevelLayout(index);
    this.levelIndex = index;
    this.world = new World(level.widthTiles, WORLD_HEIGHT_TILES, layout.bunkerFractions, level.theme);

    const groundTop = this.world.groundTop;
    const worldWidth = this.world.width;

    this.player = new Player(40 * ART_SCALE, groundTop - 40 * ART_SCALE);

    const zombies = layout.zombieFractions.map(
      (f) => new Zombie(f * worldWidth, groundTop - 20 * ART_SCALE)
    );
    const mammoths = layout.mammothFractions.map(
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
    this._prevBossState = null;
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
    if (this.phase === "enterName") {
      this._updateNameEntry();
      this.input.endFrame();
      return;
    }

    if (this.phase === "leaderboard") {
      if (this.input.wasPressed("z") || this.input.wasPressed("up")) {
        this.score = 0;
        if (this._resultPhase === "victory") {
          this.loadLevel(0);
        } else {
          this.loadLevel(this.levelIndex);
        }
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
          this.audio.victory();
          this._finishRun("victory");
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

    if (this.boss && this.boss.alive && this.boss.state !== this._prevBossState) {
      if (this.boss.state === "telegraph") this.audio.bossTelegraph();
      this._prevBossState = this.boss.state;
    }

    if (this.player.health <= 0) {
      this.audio.gameOver();
      this._finishRun("gameOver");
    } else if (!this.boss.alive) {
      this.score += SCORE.levelClearBonus * (this.levelIndex + 1);
      this.phase = "levelClear";
      this.levelClearTimer = LEVEL_CLEAR_DELAY;
      this.audio.levelClear();
    }
  }

  /** Ends the run (death or final boss defeated): every run gets a name-entry screen, and every score gets recorded — even ones that won't crack the visible top of the leaderboard. */
  _finishRun(resultPhase) {
    this._resultPhase = resultPhase;
    this._name = Array(NAME_MAX_LENGTH).fill(" ");
    this._nameCursor = 0;
    this._lastSavedEntry = null;
    this.phase = "enterName";
  }

  _updateNameEntry() {
    if (this.input.wasPressed("left")) {
      this._nameCursor = (this._nameCursor + NAME_MAX_LENGTH - 1) % NAME_MAX_LENGTH;
      this.audio.uiMove();
    }
    if (this.input.wasPressed("right")) {
      this._nameCursor = (this._nameCursor + 1) % NAME_MAX_LENGTH;
      this.audio.uiMove();
    }
    if (this.input.wasPressed("up") || this.input.wasPressed("down")) {
      const step = this.input.wasPressed("up") ? 1 : -1;
      const i = NAME_LETTERS.indexOf(this._name[this._nameCursor]);
      const next = (i + step + NAME_LETTERS.length) % NAME_LETTERS.length;
      this._name[this._nameCursor] = NAME_LETTERS[next];
      this.audio.uiMove();
    }
    if (this.input.wasPressed("x")) {
      this._finalizeName();
      return;
    }
    if (this.input.wasPressed("z")) {
      if (this._nameCursor < NAME_MAX_LENGTH - 1) {
        this._nameCursor += 1;
        this.audio.uiMove();
      } else {
        this._finalizeName();
      }
    }
  }

  _finalizeName() {
    const typed = this._name.join("").replace(/\s+$/, "");
    const name = typed.length > 0 ? typed : "PLAYER";
    const { entries, entry } = saveScore(name, this.score);
    this.leaderboard = entries;
    this._lastSavedEntry = entry;
    this.audio.uiConfirm();
    this.phase = "leaderboard";
  }

  /**
   * Kilometers left to Canada, proportional to distance travelled across the
   * whole game (every level's widthTiles), not just the current one — so it
   * always lands on exactly 0 at the end of the last level regardless of how
   * many levels exist.
   */
  _kmRemaining() {
    const isLastLevel = this.levelIndex === LEVELS.length - 1;
    const wonGame = this._resultPhase === "victory" && (this.phase === "enterName" || this.phase === "leaderboard");
    if (wonGame || (isLastLevel && this.phase === "levelClear")) {
      return 0;
    }

    const totalTiles = LEVELS.reduce((sum, level) => sum + level.widthTiles, 0);
    const completedTiles = LEVELS.slice(0, this.levelIndex).reduce(
      (sum, level) => sum + level.widthTiles,
      0
    );
    const playerTiles = this.player.x / TILE_SIZE;
    const progressTiles = Math.min(totalTiles, completedTiles + playerTiles);

    return TOTAL_DISTANCE_KM * (1 - progressTiles / totalTiles);
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
          if (enemy.health <= 0) {
            enemy.alive = false;
            this.score += this._scoreForKill(enemy);
            this.audio.enemyDeath();
          } else {
            this.audio.hit();
          }
          break;
        }
      }
    }
  }

  _scoreForKill(enemy) {
    if (enemy.isBoss) return SCORE.bossKill;
    if (enemy instanceof Mammoth) return SCORE.mammothKill;
    return SCORE.zombieKill;
  }

  _resolvePlayerContact() {
    for (const enemy of this.entities) {
      const isThreat = enemy instanceof Zombie || enemy instanceof Mammoth || enemy.isBoss;
      if (!isThreat || !enemy.alive) continue;

      if (enemy.intersects(this.player)) {
        const dir = Math.sign(this.player.x - enemy.x) || (this.player.facing === "right" ? -1 : 1);
        const wasInvulnerable = this.player.invulnTimer > 0;
        this.player.takeDamage(enemy.contactDamage ?? 1, dir);
        if (!wasInvulnerable) this.audio.playerHurt();
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

    if (this.phase !== "enterName" && this.phase !== "leaderboard") {
      this._renderHud();
    }

    if (this.phase === "enterName") {
      this._renderNameEntry();
    } else if (this.phase === "leaderboard") {
      this._renderLeaderboard();
    } else if (this.phase !== "playing") {
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

    // Distance countdown, top-left under the hearts.
    ctx.textAlign = "left";
    ctx.font = "8px monospace";
    ctx.fillStyle = "#eafff0";
    ctx.fillText(`${Math.ceil(this._kmRemaining())} KM TO CANADA`, 6, 20);

    // Score, top-left under the distance countdown.
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, 6, 30);

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

  /** Only reached for "levelClear" — the death/victory phases route through the leaderboard screens instead. */
  _renderOverlay() {
    const { ctx } = this;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    ctx.textAlign = "center";
    ctx.fillStyle = "#eafff0";
    ctx.font = "16px monospace";
    ctx.fillText("LEVEL CLEAR", VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 - 4);
    ctx.font = "8px monospace";
    ctx.fillText(LEVELS[this.levelIndex].name, VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 12);
    ctx.textAlign = "left";
  }

  _renderNameEntry() {
    const { ctx } = this;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    ctx.textAlign = "center";
    ctx.fillStyle = "#eafff0";
    ctx.font = "14px monospace";
    ctx.fillText("ENTER YOUR NAME", VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 - 40);

    ctx.font = "10px monospace";
    ctx.fillText(this.score.toLocaleString(), VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 - 24);

    const slotSpacing = 20;
    const startX = VIEWPORT_WIDTH / 2 - (slotSpacing * (NAME_MAX_LENGTH - 1)) / 2;
    ctx.font = "16px monospace";
    for (let i = 0; i < NAME_MAX_LENGTH; i++) {
      const x = startX + i * slotSpacing;
      ctx.fillStyle = i === this._nameCursor ? "#ffe066" : "#eafff0";
      ctx.fillText(this._name[i], x, VIEWPORT_HEIGHT / 2 + 6);
    }

    ctx.font = "8px monospace";
    ctx.fillStyle = "#eafff0";
    ctx.fillText("UP/DOWN CHANGE   LEFT/RIGHT MOVE", VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 24);
    ctx.fillText("Z NEXT LETTER   X DONE", VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 34);
    ctx.textAlign = "left";
  }

  _renderLeaderboard() {
    const { ctx } = this;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    ctx.textAlign = "center";
    ctx.fillStyle = "#eafff0";
    ctx.font = "16px monospace";
    ctx.fillText(this._resultPhase === "victory" ? "YOU WIN" : "GAME OVER", VIEWPORT_WIDTH / 2, 20);

    ctx.font = "10px monospace";
    ctx.fillText("LEADERBOARD", VIEWPORT_WIDTH / 2, 34);

    const nameX = 8;
    const scoreX = 230;
    const dateX = 314;
    const headerY = 46;
    const startY = 56;
    const rowHeight = 10;
    const rows = this.leaderboard.slice(0, LEADERBOARD_DISPLAY_ROWS);

    ctx.font = "7px monospace";
    ctx.fillStyle = "#8fa898";
    ctx.textAlign = "left";
    ctx.fillText("NAME", nameX, headerY);
    ctx.textAlign = "right";
    ctx.fillText("SCORE", scoreX, headerY);
    ctx.fillText("DATE", dateX, headerY);

    ctx.font = "8px monospace";
    if (rows.length === 0) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#eafff0";
      ctx.fillText("NO SCORES YET", VIEWPORT_WIDTH / 2, startY);
    } else {
      rows.forEach((entry, i) => {
        const isThisRun = entry === this._lastSavedEntry;
        ctx.fillStyle = isThisRun ? "#ffe066" : "#eafff0";
        const y = startY + i * rowHeight;
        ctx.textAlign = "left";
        ctx.fillText(`${i + 1}. ${entry.name}`, nameX, y);
        ctx.textAlign = "right";
        ctx.fillText(entry.score.toLocaleString(), scoreX, y);
        ctx.fillText(formatEntryDate(entry.date), dateX, y);
      });
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#eafff0";
    ctx.font = "8px monospace";
    ctx.fillText("PRESS Z TO CONTINUE", VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT - 10);
    ctx.textAlign = "left";
  }
}
