import { GameManager } from "../managers/GameManager.js";
import { Settings } from "../game/GameSettings.js";
import { navigate } from "../router/router.js";

export const AIController = (root: HTMLElement) => {
  // --- Game setup ---
  const settings = new Settings();
  const game = new GameManager(settings);

  // By default, play against another local player (can be extended to AI button later)
  settings.setOpponent("AI");
  settings.setAiDifficulty("MEDIUM");
  game.getInputHandler().setRemote(false);

  // --- DOM elements ---
  const startBtn = root.querySelector<HTMLButtonElement>("#startBtn")!;
  const leaveBtn = root.querySelector<HTMLButtonElement>("#leaveBtn")!;
  const easyBtn = root.querySelector<HTMLButtonElement>("#easyBtn")!;
  const mediumBtn = root.querySelector<HTMLButtonElement>("#mediumBtn")!;
  const hardBtn = root.querySelector<HTMLButtonElement>("#hardBtn")!;

  // --- Actions ---
  const onStart = () => {
    if (!game.getGameStatus().playing)
      game.getGameStatus().playing = true;
  };

  const onLeave = () => {
    if (game.getGameStatus().playing)
      game.stopGame();
    navigate("/");
  };

  // --- Button listeners ---
  startBtn.addEventListener("click", onStart);
  leaveBtn.addEventListener("click", onLeave);

  // --- Difficulty ---
  easyBtn.addEventListener("click", () => {
    if (!game.getGameStatus().playing)
      settings.setAiDifficulty("EASY");
  });

  mediumBtn.addEventListener("click", () => {
    if (!game.getGameStatus().playing)
      settings.setAiDifficulty("MEDIUM");
  });

  hardBtn.addEventListener("click", () => {
    if (!game.getGameStatus().playing)
      settings.setAiDifficulty("HARD");
  });

  // --- Cleanup ---
  return () => {
    onLeave(); // stop game if active
    startBtn.removeEventListener("click", onStart);
    leaveBtn.removeEventListener("click", onLeave);
  };
};
