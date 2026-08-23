// Scales the size of tiles, entities, and movement constants so in-game
// artifacts render as bigger/chunkier blocks without touching the viewport.
export const ART_SCALE = 2;

export const TILE_SIZE = 16 * ART_SCALE;

export const VIEWPORT_WIDTH = 320;
export const VIEWPORT_HEIGHT = 180;

export const PIXEL_SCALE = 3;

export const FIXED_TIMESTEP = 1000 / 60;
export const MAX_FRAME_DELTA = 250;
