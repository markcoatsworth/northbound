// Levels are described declaratively so new ones are just data. Enemy
// positions are fractions of the level's width so they scale with it, and
// the boss always guards the far edge.
export const WORLD_HEIGHT_TILES = 14;

export const LEVELS = [
  {
    name: "Outskirts",
    widthTiles: 60,
    zombieFractions: [0.22, 0.4, 0.6],
    mammothFractions: [0.5],
    bunkerFractions: [0.3],
    bossHealth: 14,
    bossType: "monsterTruck",
    bossName: "MONSTER TRUCK",
  },
  {
    name: "Frozen Pass",
    widthTiles: 80,
    zombieFractions: [0.15, 0.28, 0.42, 0.58, 0.7],
    mammothFractions: [0.32, 0.62],
    bunkerFractions: [0.2, 0.5],
    bossHealth: 20,
    bossType: "arctodus",
    bossName: "ARCTODUS",
  },
  {
    name: "Sunken Bunker",
    widthTiles: 90,
    zombieFractions: [0.12, 0.22, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
    mammothFractions: [0.45],
    bunkerFractions: [0.25, 0.55, 0.75],
    bossHealth: 24,
    bossType: "deinosuchus",
    bossName: "DEINOSUCHUS",
  },
  {
    name: "Last Stand",
    widthTiles: 100,
    zombieFractions: [0.12, 0.22, 0.34, 0.46, 0.58, 0.68, 0.78],
    mammothFractions: [0.25, 0.5, 0.72],
    bunkerFractions: [0.18, 0.45, 0.7],
    bossHealth: 30,
    bossType: "tRex",
    bossName: "T-REX",
  },
  {
    name: "Point Zero",
    widthTiles: 110,
    zombieFractions: [0.1, 0.18, 0.26, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74],
    mammothFractions: [0.3, 0.55, 0.8],
    bunkerFractions: [0.2, 0.4, 0.6, 0.8],
    bossHealth: 36,
    bossType: "honeyBadger",
    bossName: "HONEY BADGER",
  },
];
