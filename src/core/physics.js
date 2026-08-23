import { ART_SCALE } from "./constants.js";

export const GRAVITY = 480 * ART_SCALE;
export const TERMINAL_VELOCITY = 260 * ART_SCALE;

/**
 * Applies gravity and lands the entity on the first platform whose top it
 * crosses while falling. One-directional (landing only) — good enough until
 * the world needs side/ceiling collision too.
 */
export function applyPlatformPhysics(entity, dt, world) {
  entity.vy = Math.min(entity.vy + GRAVITY * dt, TERMINAL_VELOCITY);

  const prevBottom = entity.y + entity.height;
  entity.y += entity.vy * dt;

  entity.grounded = false;
  const bottom = entity.y + entity.height;

  for (const platform of world.platforms) {
    const overlapsX = entity.x + entity.width > platform.x && entity.x < platform.x + platform.width;
    if (!overlapsX) continue;

    const platformTop = platform.y;
    if (entity.vy >= 0 && prevBottom <= platformTop + 1 && bottom >= platformTop) {
      entity.y = platformTop - entity.height;
      entity.vy = 0;
      entity.grounded = true;
    }
  }

  entity.y = Math.max(0, Math.min(entity.y, world.height - entity.height));
}
