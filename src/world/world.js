import { TILE_SIZE, ART_SCALE } from "../core/constants.js";

const SURFACE_GROUND_HEIGHT = TILE_SIZE * 3;

const BUNKER_WIDTH = 4 * TILE_SIZE;
// A one-jump-deep step down (max jump height is ~56px at the current
// gravity/jump-velocity constants), so a bunker is always escapable.
const BUNKER_DEPTH = 20 * ART_SCALE;

// Underground tunnels: a fixed run of "solid earth" below the surface crust,
// entered through a pair of vertical shaft openings carved straight through
// it. The crust between the two shafts stays intact, so from the surface a
// tunnel just looks like normal ground with two holes in it — no terrain
// digging/editing, everything is laid out once when the level generates.
const TUNNEL_CLEARANCE = TILE_SIZE * 3; // walkable headroom inside a tunnel
const TUNNEL_FLOOR_THICKNESS = TILE_SIZE * 2;
const TUNNEL_ZONE_HEIGHT = TUNNEL_CLEARANCE + TUNNEL_FLOOR_THICKNESS;
const SHAFT_WIDTH = 3 * TILE_SIZE;
const TUNNEL_LENGTH_MIN = 10 * TILE_SIZE;
const TUNNEL_LENGTH_MAX = 18 * TILE_SIZE;
const TUNNEL_MARGIN_TILES = 10; // keep clear of the player spawn and boss arena
const TUNNEL_SPACING_MIN_TILES = 25;
const TUNNEL_SPACING_MAX_TILES = 45;

const LADDER_RAIL_COLOR = "#8a6a45";
const LADDER_RUNG_COLOR = "#c9a26b";
const LADDER_RUNG_SPACING = 10 * ART_SCALE;
const LADDER_RAIL_INSET = 6 * ART_SCALE;

// Floating platforms are scattered along the level rather than fixed, so
// levels of different lengths get proportionally more of them and no two
// loads (even of the same level) lay them out the same way.
const PLATFORM_MARGIN_TILES = 12; // keep clear of the player spawn and boss arena
const PLATFORM_SPACING_TILES_MIN = 12;
const PLATFORM_SPACING_TILES_MAX = 22;
const PLATFORM_HEIGHT_MIN = 30 * ART_SCALE;
const PLATFORM_HEIGHT_MAX = 90 * ART_SCALE;
const PLATFORM_WIDTH_MIN = 45 * ART_SCALE;
const PLATFORM_WIDTH_MAX = 85 * ART_SCALE;
const PLATFORM_THICKNESS = 12 * ART_SCALE;

// Parallax scenery + a scrolling ground texture. On their own, a flat sky and
// a flat ground give no visual reference for motion across long empty
// stretches — these layers move horizontally at different fractions of
// camera speed (and the ground ticks at full speed) so travel is always
// visible even with no entities or platforms nearby. All of it is generated
// from periodic/hashed functions of world position rather than stored
// per-level data, so it works at any level length without extra bookkeeping.
// Colors themselves come from the level's theme (see levels.js) so each
// level reads as a different place; only the geometry constants below stay
// fixed across levels.
const FAR_HILL_PARALLAX = 0.25;
const FAR_HILL_PERIOD = 220 * ART_SCALE;
const FAR_HILL_AMPLITUDE = 30 * ART_SCALE;

const NEAR_HILL_PARALLAX = 0.5;
const NEAR_HILL_PERIOD = 150 * ART_SCALE;
const NEAR_HILL_AMPLITUDE = 20 * ART_SCALE;

const TREE_PARALLAX = 0.7;
const TREE_PERIOD = 70 * ART_SCALE;
const TREE_WIDTH = 16 * ART_SCALE;
const TREE_HEIGHT_MIN = 26 * ART_SCALE;
const TREE_HEIGHT_MAX = 46 * ART_SCALE;

const GROUND_TICK_SPACING = 24 * ART_SCALE;

// Fallback palette, used for any color a level's theme doesn't override.
export const DEFAULT_THEME = {
  skyTop: "#10131a",
  skyBottom: "#1c222b",
  farHillColor: "#161b24",
  nearHillColor: "#212836",
  treeColor: "#12151b",
  groundColor: "#3a2f28",
  tunnelFloorColor: "#241f1a",
  tunnelInteriorColor: "#0d0f14",
};

// Cheap deterministic pseudo-random in [0, 1) for a given integer index —
// gives each tree a stable, varied height without storing anything.
function hash(index) {
  const value = Math.sin(index * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export class World {
  constructor(widthInTiles, heightInTiles, bunkerFractions = [], theme = {}) {
    this.widthInTiles = widthInTiles;
    this.heightInTiles = heightInTiles;
    this.width = widthInTiles * TILE_SIZE;
    this.theme = { ...DEFAULT_THEME, ...theme };

    // The world extends TUNNEL_ZONE_HEIGHT below the surface so there's room
    // for a tunnel + its floor underneath; groundTop is computed the same
    // way it always was, so surface-level gameplay (spawns, camera, jump
    // height) is unaffected by levels that happen to have tunnels.
    const surfaceHeight = heightInTiles * TILE_SIZE;
    this.height = surfaceHeight + TUNNEL_ZONE_HEIGHT;
    this.groundTop = surfaceHeight - SURFACE_GROUND_HEIGHT;

    // Ground is built as a run of segments, with a sunken "bunker" segment
    // dropped in wherever a bunker fraction lands — a shallow trench in the
    // main ground the player can drop into and jump back out of.
    this.platforms = [];
    this.tunnels = [];
    this.ladders = [];
    const bunkerCenters = [...bunkerFractions].sort((a, b) => a - b).map((f) => f * this.width);

    let cursor = 0;
    for (const center of bunkerCenters) {
      const gapStart = Math.max(cursor, Math.min(this.width - BUNKER_WIDTH, center - BUNKER_WIDTH / 2));
      if (gapStart <= cursor) continue; // no room left for this bunker; skip it

      this.platforms.push({
        x: cursor,
        y: this.groundTop,
        width: gapStart - cursor,
        height: SURFACE_GROUND_HEIGHT,
        isGround: true,
      });
      this.platforms.push({
        x: gapStart,
        y: this.groundTop + BUNKER_DEPTH,
        width: BUNKER_WIDTH,
        height: SURFACE_GROUND_HEIGHT - BUNKER_DEPTH,
        isGround: true,
      });
      cursor = gapStart + BUNKER_WIDTH;
    }
    if (cursor < this.width) {
      this.platforms.push({
        x: cursor,
        y: this.groundTop,
        width: this.width - cursor,
        height: SURFACE_GROUND_HEIGHT,
        isGround: true,
      });
    }

    this._generateTunnels();

    // Floating platforms, randomly scattered between the spawn and boss margins.
    const marginPx = PLATFORM_MARGIN_TILES * TILE_SIZE;
    const rightEdge = this.width - marginPx;
    let x = marginPx + Math.random() * (PLATFORM_SPACING_TILES_MAX * TILE_SIZE);
    while (x < rightEdge) {
      const platformWidth = PLATFORM_WIDTH_MIN + Math.random() * (PLATFORM_WIDTH_MAX - PLATFORM_WIDTH_MIN);
      const heightAboveGround = PLATFORM_HEIGHT_MIN + Math.random() * (PLATFORM_HEIGHT_MAX - PLATFORM_HEIGHT_MIN);

      this.platforms.push({
        x,
        y: this.groundTop - heightAboveGround,
        width: platformWidth,
        height: PLATFORM_THICKNESS,
      });

      const spacing = PLATFORM_SPACING_TILES_MIN + Math.random() * (PLATFORM_SPACING_TILES_MAX - PLATFORM_SPACING_TILES_MIN);
      x += platformWidth + spacing * TILE_SIZE;
    }
  }

  // Cuts a gap [gapX, gapX + gapWidth) through any isGround segment it
  // overlaps, splitting the segment into whatever remains on each side.
  // Floating platforms are untouched — a shaft is a hole in the earth, not
  // in the air.
  _carveGap(gapX, gapWidth) {
    const gapEnd = gapX + gapWidth;
    const next = [];
    for (const seg of this.platforms) {
      if (!seg.isGround) {
        next.push(seg);
        continue;
      }
      const segEnd = seg.x + seg.width;
      if (gapEnd <= seg.x || gapX >= segEnd) {
        next.push(seg);
        continue;
      }
      if (gapX > seg.x) next.push({ ...seg, width: gapX - seg.x });
      if (gapEnd < segEnd) next.push({ ...seg, x: gapEnd, width: segEnd - gapEnd });
    }
    this.platforms = next;
  }

  // Scatters underground tunnels along the level: each is a floor slab
  // sitting below the surface crust, reached through a shaft carved at
  // either end. The crust between the two shafts is left standing, so it
  // doubles as the tunnel's ceiling — a real hidden passage rather than a
  // visible pit.
  _generateTunnels() {
    const marginPx = TUNNEL_MARGIN_TILES * TILE_SIZE;
    const rightEdge = this.width - marginPx;
    let x = marginPx + Math.random() * (TUNNEL_SPACING_MAX_TILES * TILE_SIZE);

    while (x < rightEdge) {
      const tunnelLength = TUNNEL_LENGTH_MIN + Math.random() * (TUNNEL_LENGTH_MAX - TUNNEL_LENGTH_MIN);
      const rightShaftX = x + tunnelLength;
      if (rightShaftX + SHAFT_WIDTH > rightEdge) break; // no room left for a full tunnel

      this._carveGap(x, SHAFT_WIDTH);
      this._carveGap(rightShaftX, SHAFT_WIDTH);

      const tunnelFloorY = this.groundTop + SURFACE_GROUND_HEIGHT + TUNNEL_CLEARANCE;
      const floorWidth = rightShaftX + SHAFT_WIDTH - x;
      this.platforms.push({
        x,
        y: tunnelFloorY,
        width: floorWidth,
        height: TUNNEL_FLOOR_THICKNESS,
        isGround: true,
        isTunnelFloor: true,
      });
      this.tunnels.push({ x, width: floorWidth, floorY: tunnelFloorY });

      // A ladder at each shaft spans the full drop, from the surface down to
      // the tunnel floor — the only way back up, since that's well beyond
      // jump height.
      this.ladders.push({ x, width: SHAFT_WIDTH, top: this.groundTop, bottom: tunnelFloorY });
      this.ladders.push({ x: rightShaftX, width: SHAFT_WIDTH, top: this.groundTop, bottom: tunnelFloorY });

      const spacing = TUNNEL_SPACING_MIN_TILES + Math.random() * (TUNNEL_SPACING_MAX_TILES - TUNNEL_SPACING_MIN_TILES);
      x = rightShaftX + SHAFT_WIDTH + spacing * TILE_SIZE;
    }
  }

  // Returns the ladder the entity's bounding box overlaps, or null. `top`
  // and `bottom` describe where the entity's feet may range while climbing
  // (surface level down to the tunnel floor), not the entity's own y — the
  // caller offsets by its own height when clamping position.
  getLadderAt(entity) {
    for (const ladder of this.ladders) {
      const overlapsX = entity.x + entity.width > ladder.x && entity.x < ladder.x + ladder.width;
      const overlapsY = entity.y + entity.height > ladder.top && entity.y < ladder.bottom;
      if (overlapsX && overlapsY) return ladder;
    }
    return null;
  }

  render(ctx, camera) {
    this._renderSky(ctx, camera);
    this._renderHillLayer(ctx, camera, {
      color: this.theme.farHillColor,
      parallax: FAR_HILL_PARALLAX,
      period: FAR_HILL_PERIOD,
      amplitude: FAR_HILL_AMPLITUDE,
      baseWorldY: this.groundTop - 6 * ART_SCALE,
    });
    this._renderHillLayer(ctx, camera, {
      color: this.theme.nearHillColor,
      parallax: NEAR_HILL_PARALLAX,
      period: NEAR_HILL_PERIOD,
      amplitude: NEAR_HILL_AMPLITUDE,
      baseWorldY: this.groundTop + 2 * ART_SCALE,
    });
    this._renderTreeLayer(ctx, camera);
    this._renderTunnelInteriors(ctx, camera);

    for (const platform of this.platforms) {
      ctx.fillStyle = platform.isTunnelFloor ? this.theme.tunnelFloorColor : this.theme.groundColor;
      ctx.fillRect(
        Math.round(platform.x - camera.x),
        Math.round(platform.y - camera.y),
        platform.width,
        platform.height
      );
    }

    this._renderGroundTicks(ctx, camera);
    this._renderLadders(ctx, camera);
  }

  // Two rails + rungs spanning the shaft, so it reads as climbable both from
  // the surface (looking down the hole) and from inside the tunnel (looking
  // up at the way out).
  _renderLadders(ctx, camera) {
    for (const ladder of this.ladders) {
      const screenX = Math.round(ladder.x - camera.x);
      const screenTop = Math.round(ladder.top - camera.y);
      const screenBottom = Math.round(ladder.bottom - camera.y);

      ctx.strokeStyle = LADDER_RAIL_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(screenX + LADDER_RAIL_INSET, screenTop);
      ctx.lineTo(screenX + LADDER_RAIL_INSET, screenBottom);
      ctx.moveTo(screenX + ladder.width - LADDER_RAIL_INSET, screenTop);
      ctx.lineTo(screenX + ladder.width - LADDER_RAIL_INSET, screenBottom);
      ctx.stroke();

      ctx.strokeStyle = LADDER_RUNG_COLOR;
      for (let y = screenTop + LADDER_RUNG_SPACING; y < screenBottom; y += LADDER_RUNG_SPACING) {
        ctx.beginPath();
        ctx.moveTo(screenX + LADDER_RAIL_INSET, y);
        ctx.lineTo(screenX + ladder.width - LADDER_RAIL_INSET, y);
        ctx.stroke();
      }
    }
  }

  // A dark box filling the open space between the crust and the tunnel
  // floor. It's only visible through the two shaft openings (the intact
  // crust above the rest of the tunnel occludes it) until the camera
  // actually follows the player down inside.
  _renderTunnelInteriors(ctx, camera) {
    ctx.fillStyle = this.theme.tunnelInteriorColor;
    const interiorTop = this.groundTop + SURFACE_GROUND_HEIGHT;
    for (const tunnel of this.tunnels) {
      ctx.fillRect(
        Math.round(tunnel.x - camera.x),
        Math.round(interiorTop - camera.y),
        tunnel.width,
        TUNNEL_CLEARANCE
      );
    }
  }

  _renderSky(ctx, camera) {
    const gradient = ctx.createLinearGradient(0, 0, 0, camera.viewportHeight);
    gradient.addColorStop(0, this.theme.skyTop);
    gradient.addColorStop(1, this.theme.skyBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);
  }

  // A rolling silhouette sampled from a sine wave whose phase advances with
  // world x scaled by `parallax` — slower than the camera, so it visibly
  // lags the foreground and reads as "farther away."
  _renderHillLayer(ctx, camera, { color, parallax, period, amplitude, baseWorldY }) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, camera.viewportHeight);

    const step = 8;
    for (let screenX = 0; screenX <= camera.viewportWidth; screenX += step) {
      const wavePhase = camera.x * parallax + screenX;
      const worldY = baseWorldY - amplitude * (0.5 + 0.5 * Math.sin((wavePhase / period) * Math.PI * 2));
      ctx.lineTo(screenX, worldY - camera.y);
    }

    ctx.lineTo(camera.viewportWidth, camera.viewportHeight);
    ctx.closePath();
    ctx.fill();
  }

  // Evenly spaced pine silhouettes with a hashed height jitter per slot —
  // deterministic, so the same stretch of world always looks the same
  // without storing tree positions.
  _renderTreeLayer(ctx, camera) {
    ctx.fillStyle = this.theme.treeColor;
    const baseWorldY = this.groundTop + 4 * ART_SCALE;

    const worldStart = camera.x * TREE_PARALLAX - TREE_WIDTH;
    const worldEnd = camera.x * TREE_PARALLAX + camera.viewportWidth + TREE_WIDTH;
    const firstIndex = Math.floor(worldStart / TREE_PERIOD);
    const lastIndex = Math.ceil(worldEnd / TREE_PERIOD);

    for (let i = firstIndex; i <= lastIndex; i++) {
      const worldX = i * TREE_PERIOD;
      const screenX = worldX - camera.x * TREE_PARALLAX;
      const treeHeight = TREE_HEIGHT_MIN + hash(i) * (TREE_HEIGHT_MAX - TREE_HEIGHT_MIN);
      const baseY = baseWorldY - camera.y;

      ctx.beginPath();
      ctx.moveTo(screenX - TREE_WIDTH / 2, baseY);
      ctx.lineTo(screenX, baseY - treeHeight);
      ctx.lineTo(screenX + TREE_WIDTH / 2, baseY);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Tick marks scrolling at full (foreground) speed along the walkable
  // ground only — the clearest, cheapest cue that you're actually moving.
  _renderGroundTicks(ctx, camera) {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 1;

    const viewLeft = camera.x;
    const viewRight = camera.x + camera.viewportWidth;

    for (const platform of this.platforms) {
      if (!platform.isGround) continue;

      const segStart = Math.max(platform.x, viewLeft);
      const segEnd = Math.min(platform.x + platform.width, viewRight);
      if (segStart >= segEnd) continue;

      const firstTick = Math.ceil(segStart / GROUND_TICK_SPACING) * GROUND_TICK_SPACING;
      for (let worldX = firstTick; worldX < segEnd; worldX += GROUND_TICK_SPACING) {
        const screenX = Math.round(worldX - camera.x);
        const screenY = Math.round(platform.y - camera.y);
        ctx.beginPath();
        ctx.moveTo(screenX, screenY + 2);
        ctx.lineTo(screenX, screenY + 6);
        ctx.stroke();
      }
    }
  }
}
