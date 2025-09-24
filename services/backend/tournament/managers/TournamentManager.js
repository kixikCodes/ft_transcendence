import { shufflePlayers } from "../utils/shuffle.js";
import { Room, rooms } from "../../gameRooms.js";
import crypto from 'node:crypto';

export class TournamentManager {
  constructor() {
    this.tournament = {
      id: crypto.randomUUID(),
      size: 4,
      rooms: [],
      players: [],      // { id, username?, ws }
      matches: [],      // { id, p1, p2, room, ... }
      round: 0,
      status: "pending",
      waitingArea: [],  // winners waiting for next round
    };
    this.matchCounter = 0;
  }

  addPlayer(player, ws) {
    if (this.tournament.players.find((p) => p.id === player.id)) {
      throw new Error("Player already joined this tournament");
    }

    if (this.tournament.players.length >= this.tournament.size) {
      throw new Error("Tournament is already full");
    }

    const entry = { ...player, ws };
    this.tournament.players.push(entry);

    // mark the ws for fast lookup on disconnect
    if (ws) {
      ws._tournamentId = this.tournament.id;
      ws._tournamentPlayerId = player.id;
    }

    this.broadcastTournament();
    if (this.tournament.players.length === this.tournament.size) {
      this.startTournament();
    }
  }

  startTournament() {
    const shuffled = shufflePlayers(this.tournament.players);
    const matches = [];

    for (let i = 0; i < this.tournament.size; i += 2) {
      // defensive: ensure both players exist (should be true here)
      const p1 = shuffled[i];
      const p2 = shuffled[i + 1];

      if (!p1 || !p2) {
        // give bye to p1 if p2 missing
        if (p1) this.tournament.waitingArea.push(p1);
        continue;
      }

      matches.push(this.createMatch(p1, p2, 1));
    }

    this.tournament.matches = matches.filter(Boolean);
    this.tournament.round = 1;
    this.tournament.status = "active";
    this.broadcastTournament();
  }

  createMatch(p1, p2, round) {
    if (!p1 || !p2) {
      console.warn("createMatch called with missing player:", p1, p2);
      return null;
    }

    const room = new Room();
    rooms.push(room);

    // use provided ws if present; gameRooms will make safe placeholders
    room.addPlayer(p1.id, p1.ws);
    room.addPlayer(p2.id, p2.ws);

    // assign match id and backref so loop/record logic can find the tournament context
    const matchId = this.matchCounter++;
    room.matchId = matchId;
    room.tournamentManager = this;

    // Tell each player they joined (only for real connected sockets)
    for (const [ws, player] of room.players) {
      if (ws && typeof ws.send === "function" && ws.readyState === 1) {
        try {
          ws.send(JSON.stringify({
            type: "join",
            roomId: room.id,
            side: player.side,
            gameConfig: room.config,
            state: room.state,
          }));
        } catch (err) {
          console.warn("Failed to send join to player socket:", err?.message || err);
        }
      }
    }

    return {
      id: matchId,
      round,
      time: Date.now(),
      room,
      p1,
      p2,
      winner: null,
      loser: null,
      status: "pending",
    };
  }

  getTournament() {
    return this.tournament;
  }

  broadcastTournament() {
    const tournament = this.getTournament();

    const stateToSend = {
      id: tournament.id,
      status: tournament.status,
      round: tournament.round,
      players: tournament.players.map(p => ({
        id: p.id,
        username: p.username,
        score: p.score || 0,
        ready: p.ready || false
      }))
    };

    for (const player of tournament.players) {
      if (player.ws && player.ws.readyState === 1) {
        try {
          player.ws.send(JSON.stringify({
            type: "tournamentUpdate",
            state: stateToSend
          }));
        } catch (err) {
          console.warn("Failed to send tournamentUpdate to player", player.id, err?.message || err);
        }
      }
    }
  }

  /**
   * Remove a player from this tournament. This method handles both:
   *  - pending tournaments (just remove from players array),
   *  - active tournaments (find match, award opponent a win via recordMatchResult).
   */
  removePlayer(userId) {
    const t = this.tournament;

    // 1) If tournament not started, just remove
    if (t.status === "pending") {
      const idx = t.players.findIndex(p => p.id === userId);
      if (idx !== -1) {
        const [removed] = t.players.splice(idx, 1);
        if (removed.ws) {
          try {
            removed.ws.send(JSON.stringify({ type: "tournamentEliminated", reason: "left" }));
            removed.ws._tournamentId = undefined;
            removed.ws._tournamentPlayerId = undefined;
            // do not force-close here if the client already closed; swallow errors
          } catch {}
        }
        this.broadcastTournament();
      }
      return;
    }

    // 2) If tournament active, find their match
    const match = t.matches.find(m =>
      (m.p1 && m.p1.id === userId) ||
      (m.p2 && m.p2.id === userId)
    );

    // If not in a current match, maybe in waitingArea or already eliminated — remove there
    if (!match) {
      // waiting area removal (bye/winner list)
      const widx = t.waitingArea.findIndex(p => p.id === userId);
      if (widx !== -1) {
        const removed = t.waitingArea.splice(widx, 1)[0];
        if (removed.ws) {
          try {
            removed.ws.send(JSON.stringify({ type: "tournamentEliminated", reason: "left" }));
            removed.ws._tournamentId = undefined;
            removed.ws._tournamentPlayerId = undefined;
          } catch {}
        }
        this.broadcastTournament();
      } else {
        // also attempt to remove from players list as a catch-all
        t.players = t.players.filter(p => p.id !== userId);
        this.broadcastTournament();
      }
      return;
    }

    // Determine opponent and record the result (reuse recordMatchResult to keep logic in one place)
    const opponent = match.p1.id === userId ? match.p2 : match.p1;
    if (!opponent) {
      // if no opponent for some reason, just remove and broadcast
      t.players = t.players.filter(p => p.id !== userId);
      this.broadcastTournament();
      return;
    }

    // Use recordMatchResult to ensure room cleanup, elimination message, and advancing/winners handling
    try {
      this.recordMatchResult(match.id, opponent.id);
    } catch (err) {
      console.error("Failed to record match result during removePlayer:", err?.message || err);
    }
  }

  /**
   * Convenience: remove player by socket reference
   */
  removePlayerBySocket(ws) {
    if (!ws) return;
    const entry = this.tournament.players.find(p => p.ws === ws);
    if (entry) {
      this.removePlayer(entry.id);
      return;
    }
    const waiting = this.tournament.waitingArea.find(p => p.ws === ws);
    if (waiting) {
      this.removePlayer(waiting.id);
      return;
    }
    // search matches
    const match = this.tournament.matches.find(m => (m.p1 && m.p1.ws === ws) || (m.p2 && m.p2.ws === ws));
    if (match) {
      const id = (match.p1 && match.p1.ws === ws) ? match.p1.id : match.p2.id;
      this.removePlayer(id);
    }
  }

  recordMatchResult(matchId, winnerId) {
    const match = this.tournament.matches.find((m) => m.id == matchId);
    if (!match) throw new Error("Match not found");

    match.winner = match.p1.id === winnerId ? match.p1 : match.p2;
    match.loser = match.p1.id === winnerId ? match.p2 : match.p1;
    match.status = "completed";

    // Stop the room loop
    if (match.room.loopInterval) {
      clearInterval(match.room.loopInterval);
      match.room.loopInterval = null;
    }

    // Close the room so losers are disconnected
    for (const [ws, player] of match.room.players) {
      if (player.id === match.loser.id) {
        match.room.players.delete(ws);
        if (ws && ws.readyState === 1) {
          try {
            ws.send(JSON.stringify({ type: "tournamentEliminated" }));
            ws.close();
          } catch {}
        }
        if (ws) {
          ws._tournamentId = undefined;
          ws._tournamentPlayerId = undefined;
        }
      }
    }

    // Remove losers from tournament players
    this.tournament.players = this.tournament.players.filter(
      (p) => p.id !== match.loser.id
    );

    // Add winner to waiting area
    this.tournament.waitingArea.push(match.winner);

    this.checkRoundReady();
    this.broadcastTournament();
  }

  checkRoundReady() {
    const currentRoundMatches = this.tournament.matches.filter(
      (m) => m.round === this.tournament.round
    );

    if (!currentRoundMatches.every((m) => m.status === "completed")) return;

    const winners = this.tournament.waitingArea;

    if (winners.length === 1) {
      const champion = winners[0];
      if (champion.ws && champion.ws.readyState === 1) {
        try {
          champion.ws.send(JSON.stringify({ type: "tournamentComplete" }));
          champion.ws.close();
        } catch {}
      }
      this.tournament.status = "completed";
      return;
    }

    this.advanceRound();
  }

  advanceRound() {
    const winners = this.tournament.waitingArea;
    this.tournament.size = Math.floor(this.tournament.size / 2);
    this.tournament.waitingArea = [];

    const newMatches = [];
    for (let i = 0; i < winners.length; i += 2) {
      const p1 = winners[i];
      const p2 = winners[i + 1];

      if (!p2) {
        // odd number of winners -> bye for p1
        this.tournament.waitingArea.push(p1);
        continue;
      }

      const m = this.createMatch(p1, p2, this.tournament.round + 1);
      if (m) newMatches.push(m);
    }

    this.tournament.matches.push(...newMatches);
    this.tournament.round++;
    this.broadcastTournament();
  }
}
