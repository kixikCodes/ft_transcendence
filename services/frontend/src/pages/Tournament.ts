import { ws } from "../services/ws.js";
import type { ServerState } from "../interfaces/GameInterfaces.js";
import { GameManager } from "../managers/GameManager.js";
import { Settings } from "../game/GameSettings.js";
import { navigate } from "../router/router.js";

export const TournamentController = async (root: HTMLElement) => {
  // Initialize settings and game
  const settings = new Settings();
  const game = new GameManager(settings);

  // Get current user
  const user = await fetch(`https://${location.host}/api/me`, {
    method: "GET",
    credentials: "include",
  }).then(r => r.json());

  if (!user?.id) {
    console.error("User not authenticated");
    return () => {};
  }
  const userId = user.id;

  // Connect websocket
  ws.connect(userId);
  if (ws && ws.userId) {
    ws.send({ type: "joinTournament", userId: ws.userId });
  }

  // Ensure inputs are sent remotely
  game.getInputHandler().bindRemoteSender((dir) => {
    if (game.getInputHandler().isInputRemote() && ws) {
      ws.send({ type: "input", direction: dir });
    }
  });

  // --- DOM elements ---
  const startBtn = root.querySelector<HTMLButtonElement>("#startBtn");
  const leaveBtn = root.querySelector<HTMLButtonElement>("#leaveTournament");
  const statusEl = root.querySelector<HTMLDivElement>("#tournamentStatus");

  // --- WS event listeners ---
  ws.on("join", (msg) => {
    console.log("Tournament join:", msg);

    game.setConfig(msg.gameConfig);
    game.applyServerState(msg.state);

    // Make sure inputs are sent remotely
    game.getInputHandler().setRemote(true);
    settings.setOpponent("REMOTE");
  });

  ws.on("tournamentUpdate", (msg: { type: "tournamentUpdate"; state: any }) => {
    console.log("Tournament update:", msg.state);

    if (statusEl) {
      statusEl.textContent = `Tournament ${msg.state.id} — ${msg.state.status} — Round ${msg.state.round}`;
    }
  });

  ws.on("state", (m: { type: "state"; state: ServerState }) => {
    game.applyServerState(m.state);
  });

  ws.on("tournamentEliminated", () => {
    alert("You have been eliminated from the tournament!");
    navigate("/");
  });

  // --- Button actions ---
  startBtn?.addEventListener("click", () => {
    if (ws) ws.send({ type: "ready", userId });
  });

  leaveBtn?.addEventListener("click", () => {
    if (ws) ws.send({ type: "leave", userId });
    navigate("/");
  });

  // --- Cleanup ---
  return () => {
    onLeave();
    ws.close();

    startBtn?.removeEventListener("click", () => {});
    leaveBtn?.removeEventListener("click", () => {});
  };

  function onLeave() {
    try {
      ws.send({ type: "leave", userId });
    } catch {
      ws.close();
    }
  }
};
