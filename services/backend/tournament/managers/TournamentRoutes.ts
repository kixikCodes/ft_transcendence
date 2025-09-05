import { FastifyInstance } from "fastify";
import { Player } from "../interfaces/TournamentInterfaces.ts";
import { TournamentManager } from "./TournamentManager.ts";

let tournaments: Record<string, TournamentManager> = {};

export default async function tournamentRoutes(fastify: FastifyInstance) {

  fastify.post("/tournaments", async (req, reply) => {
    const { players, size } = req.body as { players: Player[], size: 4 | 8 | 16 };
    const manager = new TournamentManager(players, size);
    tournaments[manager.getTournament().id] = manager;
    return manager.getTournament();
  });

  fastify.post("/tournaments/:id/matches/:matchId/result", async (req, reply) => {
    const { id, matchId } = req.params as { id: string, matchId: number };
    const { winnerId } = req.body as { winnerId: number };

    const manager = tournaments[id];
    manager.recordMatchResult(matchId, winnerId);
    return manager.getTournament();
  });

  fastify.get("/tournaments/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    return tournaments[id]?.getTournament();
  });
}
