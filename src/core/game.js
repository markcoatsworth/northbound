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
import { loadLeaderboard, saveScore, qualifiesForLeaderboard } from "./leaderboard.js";

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

const INITIALS_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

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
    this._initials = ["A", "A", "A"];
    this._initialsCursor = 0;

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
    if (this.phase === "enterInitials") {
      this._updateInitialsEntry();
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

  /** Ends the run (death or final boss defeated): route to initials entry if the score makes the table, otherwise straight to the leaderboard view. */
  _finishRun(resultPhase) {
    this._resultPhase = resultPhase;
    this.leaderboard = loadLeaderboard();
    if (qualifiesForLeaderboard(this.score, this.leaderboard)) {
      this._initials = ["A", "A", "A"];
      this._initialsCursor = 0;
      this.phase = "enterInitials";
    } else {
      this.phase = "leaderboard";
    }
  }

  _updateInitialsEntry() {
    if (this.input.wasPressed("left")) {
      this._initialsCursor = (this._initialsCursor + 2) % 3;
      this.audio.uiMove();
    }
    if (this.input.wasPressed("right")) {
      this._initialsCursor = (this._initialsCursor + 1) % 3;
      this.audio.uiMove();
    }
    if (this.input.wasPressed("up") || this.input.wasPressed("down")) {
      const step = this.input.wasPressed("up") ? 1 : -1;
      const i = INITIALS_LETTERS.indexOf(this._initials[this._initialsCursor]);
      const next = (i + step + INITIALS_LETTERS.length) % INITIALS_LETTERS.length;
      this._initials[this._initialsCursor] = INITIALS_LETTERS[next];
      this.audio.uiMove();
    }
    if (this.input.wasPressed("z")) {
      if (this._initialsCursor < 2) {
        this._initialsCursor += 1;
        this.audio.uiMove();
      } else {
        this.leaderboard = saveScore(this._initials.join(""), this.score, LEVELS[this.levelIndex].name);
        this.audio.uiConfirm();
        this.phase = "leaderboard";
      }
    }
  }

  /**
   * Kilometers left to Canada, proportional to distance travelled across the
   * whole game (every level's widthTiles), not just the current one — so it
   * always lands on exactly 0 at the end of the last level regardless of how
   * many levels exist.
   */
  _kmRemaining() {
    const isLastLevel = this.levelIndex === LEVELS.length - 1;
    const wonGame = this._resultPhase === "victory" && (this.phase === "enterInitials" || this.phase === "leaderboard");
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

    if (this.phase !== "enterInitials" && this.phase !== "leaderboard") {
      this._renderHud();
    }

    if (this.phase === "enterInitials") {
      this._renderInitialsEntry();
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

  _renderInitialsEntry() {
    const { ctx } = this;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    ctx.textAlign = "center";
    ctx.fillStyle = "#eafff0";
    ctx.font = "16px monospace";
    ctx.fillText("NEW HIGH SCORE", VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 - 40);

    ctx.font = "10px monospace";
    ctx.fillText(this.score.toLocaleString(), VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 - 24);

    const letterSpacing = 24;
    const startX = VIEWPORT_WIDTH / 2 - letterSpacing;
    ctx.font = "20px monospace";
    for (let i = 0; i < 3; i++) {
      const x = startX + i * letterSpacing;
      ctx.fillStyle = i === this._initialsCursor ? "#ffe066" : "#eafff0";
      ctx.fillText(this._initials[i], x, VIEWPORT_HEIGHT / 2 + 6);
    }

    ctx.font = "8px monospace";
    ctx.fillStyle = "#eafff0";
    ctx.fillText("UP/DOWN CHANGE   LEFT/RIGHT MOVE   Z CONFIRM", VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2 + 26);
    ctx.textAlign = "left";
  }

  _renderLeaderboard() {
    const { ctx } = this;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    ctx.textAlign = "center";
    ctx.fillStyle = "#eafff0";
    ctx.font = "16px monospace";
    ctx.fillText(this._resultPhase === "victory" ? "YOU WIN" : "GAME OVER", VIEWPORT_WIDTH / 2, 24);

    ctx.font = "10px monospace";
    ctx.fillText("LEADERBOARD", VIEWPORT_WIDTH / 2, 40);

    ctx.font = "8px monospace";
    const startY = 54;
    const rowHeight = 10;

    if (this.leaderboard.length === 0) {
      ctx.fillText("NO SCORES YET", VIEWPORT_WIDTH / 2, startY);
    } else {
      const justSubmitted = this._initials.join("");
      this.leaderboard.forEach((entry, i) => {
        const isThisRun = entry.initials === justSubmitted && entry.score === this.score;
        ctx.fillStyle = isThisRun ? "#ffe066" : "#eafff0";
        const y = startY + i * rowHeight;
        ctx.textAlign = "left";
        ctx.fillText(`${i + 1}. ${entry.initials}`, VIEWPORT_WIDTH / 2 - 70, y);
        ctx.textAlign = "right";
        ctx.fillText(entry.score.toLocaleString(), VIEWPORT_WIDTH / 2 + 70, y);
      });
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#eafff0";
    ctx.font = "8px monospace";
    ctx.fillText("PRESS Z TO CONTINUE", VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT - 12);
    ctx.textAlign = "left";
  }
}
