// Levels are described declaratively so new ones are just data. Enemy and
// bunker counts scale up per level; their actual positions are randomized
// fresh every time the level (re)loads via generateLevelLayout() below, so
// replaying a level — or reaching it again — doesn't look the same twice.
export const WORLD_HEIGHT_TILES = 14;

// The road-to-Canada countdown covers this many kilometers across the whole
// game, split proportionally by each level's widthTiles — so adding or
// resizing levels later automatically rebalances the countdown instead of
// needing a manual retune.
export const TOTAL_DISTANCE_KM = 500;

export const LEVELS = [
  {
    name: "Outskirts",
    widthTiles: 90,
    zombieCount: 4,
    mammothCount: 1,
    bunkerCount: 1,
    bossHealth: 14,
    bossType: "monsterTruck",
    bossName: "MONSTER TRUCK",
    theme: {
      skyTop: "#181410",
      skyBottom: "#2a221a",
      farHillColor: "#221c16",
      nearHillColor: "#332a1f",
      treeColor: "#1c1712",
      groundColor: "#3a2f28",
      tunnelFloorColor: "#241f1a",
      tunnelInteriorColor: "#0d0a08",
    },
  },
  {
    name: "Frozen Pass",
    widthTiles: 120,
    zombieCount: 6,
    mammothCount: 2,
    bunkerCount: 2,
    bossHealth: 20,
    bossType: "arctodus",
    bossName: "ARCTODUS",
    theme: {
      skyTop: "#0d1420",
      skyBottom: "#233246",
      farHillColor: "#182838",
      nearHillColor: "#25384c",
      treeColor: "#1a2a30",
      groundColor: "#4a5560",
      tunnelFloorColor: "#232b30",
      tunnelInteriorColor: "#0a1015",
    },
  },
  {
    name: "Sunken Bunker",
    widthTiles: 140,
    zombieCount: 8,
    mammothCount: 2,
    bunkerCount: 3,
    bossHealth: 24,
    bossType: "deinosuchus",
    bossName: "DEINOSUCHUS",
    theme: {
      skyTop: "#0e150f",
      skyBottom: "#1b2a1c",
      farHillColor: "#16241a",
      nearHillColor: "#233a26",
      treeColor: "#152016",
      groundColor: "#2e3a20",
      tunnelFloorColor: "#1f2417",
      tunnelInteriorColor: "#0a0f08",
    },
  },
  {
    name: "Last Stand",
    widthTiles: 160,
    zombieCount: 10,
    mammothCount: 3,
    bunkerCount: 3,
    bossHealth: 30,
    bossType: "tRex",
    bossName: "T-REX",
    theme: {
      skyTop: "#1a0f0d",
      skyBottom: "#3a1f16",
      farHillColor: "#241512",
      nearHillColor: "#3a201a",
      treeColor: "#140d0b",
      groundColor: "#3a1f18",
      tunnelFloorColor: "#241512",
      tunnelInteriorColor: "#0d0806",
    },
  },
  {
    name: "Point Zero",
    widthTiles: 180,
    zombieCount: 12,
    mammothCount: 3,
    bunkerCount: 4,
    bossHealth: 36,
    bossType: "honeyBadger",
    bossName: "HONEY BADGER",
    theme: {
      skyTop: "#0d0e1a",
      skyBottom: "#1e2140",
      farHillColor: "#14162a",
      nearHillColor: "#20243f",
      treeColor: "#12142a",
      groundColor: "#2a2c3f",
      tunnelFloorColor: "#1c1e30",
      tunnelInteriorColor: "#08091a",
    },
  },
];

// Spreads `count` values across [min, max] by splitting the range into equal
// slots and jittering one point inside each — keeps entities from clustering
// while still differing on every call.
function scatterFractions(count, { min = 0.08, max = 0.9 } = {}) {
  if (count <= 0) return [];
  const span = (max - min) / count;
  const fractions = [];
  for (let i = 0; i < count; i++) {
    fractions.push(min + i * span + Math.random() * span);
  }
  return fractions;
}

/** Randomized enemy/bunker placement for a level, regenerated on every load. */
export function generateLevelLayout(levelIndex) {
  const level = LEVELS[levelIndex];
  return {
    zombieFractions: scatterFractions(level.zombieCount),
    mammothFractions: scatterFractions(level.mammothCount, { min: 0.15, max: 0.85 }),
    bunkerFractions: scatterFractions(level.bunkerCount, { min: 0.15, max: 0.85 }),
  };
}
