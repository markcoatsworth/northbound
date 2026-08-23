import { Game } from "./core/game.js";

const canvas = document.getElementById("game-canvas");
const game = new Game(canvas);

document.querySelectorAll("#controls [data-action]").forEach((button) => {
  game.input.bindButton(button, button.dataset.action);
});

// Add entries here once real art lands, e.g. { player: "/assets/sprites/player.png" }
const ASSET_MANIFEST = {};

game.init(ASSET_MANIFEST).then(() => {
  game.start();
});
