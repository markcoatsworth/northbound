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
