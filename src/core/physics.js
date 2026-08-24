import { ART_SCALE } from "./constants.js";

export const GRAVITY = 480 * ART_SCALE;
export const TERMINAL_VELOCITY = 260 * ART_SCALE;

/**
 * Applies gravity and lands the entity on the first platform whose top it
 * crosses while falling. Landing is one-directional for every platform
 * (floating platforms are deliberately jump-through from underneath), but
 * `isGround` platforms (surface/bunker/tunnel-floor earth, as opposed to
 * floating platforms) also block a rising entity from its underside — solid
 * ground, unlike a thin platform, was never meant to be jumped through, and
 * tunnels are the first place an entity can actually be beneath one.
 */
export function applyPlatformPhysics(entity, dt, world) {
  entity.vy = Math.min(entity.vy + GRAVITY * dt, TERMINAL_VELOCITY);

  const prevTop = entity.y;
  const prevBottom = entity.y + entity.height;
  entity.y += entity.vy * dt;

  entity.grounded = false;
  const top = entity.y;
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

    if (platform.isGround && entity.vy < 0) {
      const platformBottom = platform.y + platform.height;
      if (prevTop >= platformBottom - 1 && top <= platformBottom) {
        entity.y = platformBottom;
        entity.vy = 0;
      }
    }
  }

  // Walking sideways off a lower platform (e.g. a bunker's sunken floor)
  // into a taller one's footprint has no falling edge to trigger the check
  // above, so pop the entity back on top of anything it's still embedded
  // in. Guarded to falling/resting entities so jumping up through a
  // platform from underneath still passes through as before.
  if (entity.vy >= 0) {
    for (const platform of world.platforms) {
      const overlapsX = entity.x + entity.width > platform.x && entity.x < platform.x + platform.width;
      const embedded = entity.y + entity.height > platform.y && entity.y < platform.y + platform.height;
      if (!overlapsX || !embedded) continue;

      entity.y = platform.y - entity.height;
      entity.vy = 0;
      entity.grounded = true;
    }
  }

  entity.y = Math.max(0, Math.min(entity.y, world.height - entity.height));
}
