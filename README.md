# Northbound

A pixel art escape game — survive a world full of zombies and mammoths.

## Getting started

```
npm install
npm run dev
```

Opens a dev server with hot reload. Build for release with `npm run build`.

## Structure

```
index.html            Canvas + HUD shell
src/
  main.js             Entry point
  styles.css
  core/
    constants.js       Viewport size, pixel scale, timestep
    game.js            Game class: owns canvas, entities, loop
    loop.js            Fixed-timestep update/render loop
    input.js            Keyboard input (WASD/arrows, shift to run)
    camera.js           Follows the player, clamps to world bounds
    assetLoader.js      Loads image assets by key
    spritesheet.js       SpriteSheet + Animation helpers
  entities/
    entity.js           Base class (position, size, AABB collision)
    player.js
    zombie.js
    mammoth.js
    physics.js          Gravity + platform landing shared by player/enemies
  world/
    world.js            Placeholder ground + floating platforms; swap in a real tilemap later
assets/
  sprites/, tilesets/, audio/   Drop art and sound in here
```

Entities render as flat-colored rectangles until real sprite sheets are
wired up — assign `entity.sprite = new SpriteSheet(image, frameWidth, frameHeight)`
once art lands, and load images through the manifest passed to `game.init()`
in `src/main.js`.

## Controls

Side-scroller: left/right walk, up jumps, down fast-falls while airborne.
Z/X/C fire three distinct weapons (fast/weak, spread, slow/heavy), each on
its own cooldown.

- Keyboard: arrows or WASD to move, Space also jumps, Z/X/C to shoot
- On-screen: a D-pad (bottom-left) and Z/X/C buttons (bottom-right), same
  underlying input actions as the keyboard — see `Input.bindButton` in
  `src/core/input.js`
