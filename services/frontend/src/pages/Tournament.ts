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
  }).then((r) => r.json());

  if (!user?.id) {
    console.error("User not authenticated");
    return () => {};
  }
  const userId = user.id;

  // Connect websocket
  ws.connect(userId);

  // Ensure inputs are sent remotely
  game.getInputHandler().bindRemoteSender((dir) => {
    if (game.getInputHandler().isInputRemote() && ws) {
      ws.send({ type: "input", direction: dir });
    }
  });

  // --- DOM elements ---
  const startBtn = root.querySelector<HTMLButtonElement>("#startBtn");
  const leaveBtn = root.querySelector<HTMLButtonElement>("#leaveBtn");
  const joinBtn = root.querySelector<HTMLButtonElement>("#joinBtn");
  const statusEl = root.querySelector<HTMLDivElement>("#tournamentStatus");

  // --- WebSocket event handlers ---
  const onJoin = (msg: any) => {
    console.log("Tournament join:", msg);
    game.setConfig(msg.gameConfig);
    game.applyServerState(msg.state);
    game.getInputHandler().setRemote(true);
    settings.setOpponent("REMOTE");
  };

  const onTournamentUpdate = (msg: { type: "tournamentUpdate"; state: any }) => {
    console.log("Tournament update:", msg.state);
    if (statusEl) {
      statusEl.textContent = `Tournament ${msg.state.id} — ${msg.state.status} — Round ${msg.state.round}`;
    }
  };

  const onState = (m: { type: "state"; state: ServerState }) => {
    game.applyServerState(m.state);
  };

  const onEliminated = () => {
    alert("You have been eliminated from the tournament!");
    navigate("/");
  };

  const onComplete = () => {
    alert("You are the winner of this tournament! Well done!");
    navigate("/");
  };

  ws.on("join", onJoin);
  ws.on("tournamentUpdate", onTournamentUpdate);
  ws.on("state", onState);
  ws.on("tournamentEliminated", onEliminated);
  ws.on("tournamentComplete", onComplete);

  // --- Button handlers ---
  const onStart = () => {
    if (ws) ws.send({ type: "ready", userId });
  };

  const onJoinBtn = () => {
    if (ws && ws.userId) {
      ws.send({ type: "joinTournament", userId: ws.userId });
    }
  };

  const onLeaveBtn = () => {
    if (ws) {
      ws.send({ type: "leave", userId });
      ws.close();
    }
    navigate("/");
  };

  startBtn?.addEventListener("click", onStart);
  joinBtn?.addEventListener("click", onJoinBtn);
  leaveBtn?.addEventListener("click", onLeaveBtn);

  // --- Cleanup ---
  return () => {
    onLeave();

    // remove WS listeners
    ws.off("join", onJoin);
    ws.off("tournamentUpdate", onTournamentUpdate);
    ws.off("state", onState);
    ws.off("tournamentEliminated", onEliminated);
    ws.off("tournamentComplete", onComplete);
    ws.close();

    // remove button listeners
    startBtn?.removeEventListener("click", onStart);
    joinBtn?.removeEventListener("click", onJoinBtn);
    leaveBtn?.removeEventListener("click", onLeaveBtn);
  };

  function onLeave() {
    try {
      ws.send({ type: "leave", userId });
    } catch {
      ws.close();
    }
  }
};
