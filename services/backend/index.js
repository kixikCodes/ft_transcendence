import Fastify from "fastify";
import sqlite3 from "sqlite3";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import metricsPlugin from "fastify-metrics";
import bcrypt from "bcryptjs";
import { getOrCreateRoom, rooms } from "./gameRooms.js";
import { initDb } from "./initDatabases.js";
import { broadcaster } from "./utils.js";
import { buildWorld, movePaddles, moveBall } from "@app/shared";

const fastify = Fastify({ logger: true });
const db = new sqlite3.Database("./data/database.sqlite");

// Register plugins
await fastify.register(cors, {origin: true,});
await fastify.register(websocket);
await fastify.register(metricsPlugin, {
  endpoint: "/metrics",
  enableDefaultMetrics: true,
});

// Initialize database
initDb(db);

fastify.get("/users", (request, reply) => {
  db.all("SELECT * FROM users", [], (err, rows) => {
    if (err) {
      reply.code(500).send({ error: err.message });
    } else {
      reply.send(rows);
    }
  });
});

fastify.post("/api/login", (request, reply) => {
	const { username, password } = request.body;
	if (!username || !password) {
		return reply.code(400).send({ error: "Missing fields" });
	}
	db.get(
		"SELECT * FROM users WHERE username = ?",
		[username],
		(err, user) => {
			if (err) return reply.code(500).send({ error: err.message })
			if (!user) return reply.code(400).send({ error: "Invalid credentials" })
			const isValid = bcrypt.compareSync(password, user.password_hash);
			if (!isValid) return reply.code(400).send({ error: "Invalid credentials" })
			reply.send({ id: user.id, username: user.username, email: user.email })
		}
	);
});

// WebSocket Set
const clients = new Set();
fastify.get("/ws", { websocket: true }, (connection, req) => {
	const ws = connection.socket;
	clients.add(ws);

	ws.on("close", () => clients.delete(ws));

  // When (on the server side) a message is received from a client, parse it and store it in the db and broadcast it to the others
  ws.on("message", (message) => {
    try {
      const parsed = JSON.parse(message);
      const { type } = parsed;
      console.log("parsed message:", parsed);
      console.log("Backend: Received message type:", type);

      if (type === "chat") {
        const { userId, content } = parsed;
        db.run("INSERT INTO messages (userId, content) VALUES (?, ?)", [
          userId,
          content,
        ]);
        // Send the message, which the client sent to all connected clients
        broadcaster(clients, ws, JSON.stringify({ type: 'chat', userId: userId, content: content }));
      } else if (type === "join") {
        // Join a game room
        const { roomId, userId } = parsed;
        const room = getOrCreateRoom(roomId);
        room.addPlayer(userId, ws);
        // Response to the client, which side the player is on and the current state to render the initial game state
        ws.send(JSON.stringify({ type: "join", side: ws._side, gameConfig: room.config, state: room.state }));
      } else if (type === "ready") {
        const room = rooms.get(ws._roomId);
        // If the player is already ready
        if (room.getPlayer(ws).ready) return;
        room.getPlayer(ws).ready = true;
        startLoop(room);
        const { userId } = parsed;
        console.log(`User ${userId} is ready`);
        // broadcaster(room.players.keys(), null, JSON.stringify({ type: "ready", userId: userId }));
      } else if (type === "input") {
        console.log("Backend: Received input from client:", parsed);
        const { direction } = parsed;
        const room = rooms.get(ws._roomId);
        if (!room || !room.state.started) return;
        if (ws._side === "left")  room.inputs.left  = direction;
        else if (ws._side === "right") room.inputs.right = direction;
      }
    } catch (e) {
      console.error("Invalid JSON received:", message);
      return;
    }
  });
});

function startLoop(room) {
  // If the game is already started, do nothing
  if (room.state.started) return;

  // If both players are ready, start the game
  if (room.players.size === 2 && Array.from(room.players.values()).every((p) => p.ready)) {
    room.state.started = true;
    // Initialize timestamp
    room.state.timestamp = Date.now();
    // Start the game loop, which updates the game state and broadcasts it to the players every 16ms
    room.loopInterval = setInterval(() => loop(room), 16);
    // Send to the backend log that the game has started in a specific room
    console.log("Game started in room", room.id);
    // Broadcast the timestamp to the players
    broadcaster(room.players.keys(), null, JSON.stringify({ type: "start", timestamp: room.state.timestamp }));
  }
}

function stopRoom(room, roomId) {
  // Destroy the room and stop the game loop
  if (room.loopInterval) clearInterval(room.loopInterval);
  rooms.delete(roomId);
}

// This function is called every 33ms to update the game state based on the current state and player input.
// Then broadcast it to the players, so that they can render the new state
function loop(room) {

  const config = room.config;
  movePaddles(room.tempState, room.inputs, config);
  moveBall(room.tempState, room.ballV, config);

  room.state.p1Y = room.tempState.p1Y;
  room.state.p2Y = room.tempState.p2Y;
  room.state.ballX = room.tempState.ballX;
  room.state.ballY = room.tempState.ballY;
  room.state.scoreL = room.tempState.scoreL;
  room.state.scoreR = room.tempState.scoreR;

  // broadcast the new state to the players
  broadcaster(room.players.keys(), null, JSON.stringify({ type: "state", state: room.state }));
  // console.log("Broadcasted state:", room.state);
}

// Start the Fastify server on port 3000 hosting on all interfaces
fastify.listen({ port: 3000, host: "0.0.0.0" }, (err) => {
	if (err) {
		fastify.log.error(err);
		process.exit(1);
	}
	fastify.log.info("Backend running on port 3000");
});