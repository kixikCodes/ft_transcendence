import { Tournament, Player, Match } from "../interfaces/TournamentInterfaces.ts";
import { shufflePlayers } from "../utils/shuffle.ts";
import { Room } from "../../gameRooms.js";

export class TournamentManager {
    private tournament: Tournament;
    private matchCounter = 0;

    constructor(players: Player[], size: 4 | 8 | 16) {
        if (players.length !== size)
            throw new Error("Player count mismatch");

        const shuffled = shufflePlayers(players);
        const matches: Match[] = [];

        for (let i = 0; i < size; i += 2) {
            matches.push(this.createMatch(shuffled[i], shuffled[i+1], 1));
        }

        this.tournament = {
            id: crypto.randomUUID(),
            size,
            rooms: [],
            players,
            matches,
            round: 1,
            status: "active",
            waitingArea: []
        };
    }

    private createMatch(p1: Player, p2: Player, round: number): Match {
        return {
            id: this.matchCounter++,
            round,
            time: Date.now(),
            room: new Room(),
            p1,
            p2,
            winner: null,
            loser: null,
            status: "pending"
        };
    }

    public getTournament(): Tournament {
        return this.tournament;
    }

    public recordMatchResult(matchId: number, winnerId: number) {
        const match = this.tournament.matches.find(m => m.id === matchId);
        if (!match) throw new Error("Match not found");
        if (match.status === "completed") throw new Error("Match already completed");

        if (match.p1?.id !== winnerId && match.p2?.id !== winnerId)
            throw new Error("Invalid winner");

        match.winner = match.p1?.id === winnerId ? match.p1! : match.p2!;
        match.loser  = match.p1?.id === winnerId ? match.p2! : match.p1!;
        match.status = "completed";

        // Move winner to waiting area
        this.tournament.waitingArea.push(match.winner);
        this.checkRoundReady();
    }

	private checkRoundReady() {
		const currentRoundMatches = this.tournament.matches.filter(
			m => m.round === this.tournament.round
		);

		// If not all matches in this round are completed, do nothing
		if (!currentRoundMatches.every(m => m.status === "completed")) return;

		// Count how many winners are in waiting area
		const totalWinners = currentRoundMatches.length;
		const arrived = this.tournament.waitingArea.length;

		// Half threshold reached: players are waiting
		if (arrived >= totalWinners / 2 && arrived < totalWinners) {
			console.log(`Half of the players are in the waiting area (round ${this.tournament.round})`);
			return;
		}

		// Full threshold reached: advance to next round
		if (arrived === totalWinners) {
			this.advanceRound();
		}
	}


    private advanceRound() {
        const winners = this.tournament.waitingArea;
        this.tournament.waitingArea = [];

        if (winners.length === 1) {
            this.tournament.status = "completed";
            return;
        }

        const newMatches: Match[] = [];
        for (let i = 0; i < winners.length; i += 2) {
            newMatches.push(this.createMatch(winners[i], winners[i+1], this.tournament.round + 1));
        }

        this.tournament.matches.push(...newMatches);
        this.tournament.round++;
    }
}
