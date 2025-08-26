import Fastify from "fastify";
import sqlite3 from "sqlite3";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { getOrCreateRoom, rooms } from "./gameRooms.js";
import { initDb } from "./initDatabases.js";
import { broadcaster } from "./utils.js";
import { startGameLoop } from "./game.js";

const fastify = Fastify({ logger: true });
// const db = new sqlite3.Database('./database.sqlite');
// Initialize SQLite database in the data folder
const db = new sqlite3.Database("./data/database.sqlite");

// Register CORS and WebSocket plugins
await fastify.register(cors, {
  origin: true,
});
await fastify.register(websocket);

// Call the initDb function to create the tables by the time the server starts
initDb(db);

// fastify.get("/users", (request, reply) => {
//   db.all("SELECT * FROM users", [], (err, rows) => {
//     if (err) {
//       reply.code(500).send({ error: err.message });
//     } else {
//       reply.send(rows);
//     }
//   });
// });

// Test for adding a user via POST request to the database
fastify.post("/users", (request, reply) => {
  const { name } = request.body;
  if (!name) {
    reply.code(400).send({ error: "Name is required" });
    return;
  }
  db.run("INSERT INTO users (name) VALUES (?)", [name], function (err) {
    if (err) {
      reply.code(500).send({ error: err.message });
    } else {
      reply.send({ id: this.lastID, name });
    }
  });
});

fastify.get("/initState", (request, reply) => {
  const initialState = {
    p1Y: 0,
    p2Y: 0,
    ballX: 0,
    ballY: 0,
    scoreL: 0,
    scoreR: 0,
    started: false,
  };
  reply.send(initialState);
});

// Database inspection endpoint
// fastify.get("/db/info", (request, reply) => {
//   db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
//     if (err) {
//       reply.code(500).send({ error: err.message });
//     } else {
//       reply.send({
//         table: "users",
//         userCount: row.count,
//         timestamp: new Date().toISOString(),
//       });
//     }
//   });
// });

// WebSocket Set
const clients = new Set();

// This get endpoint will be used to establish a websocket connection
// New sockets/connections are added to the clients set (at the moment)
// Later this should be moved to a more sophisticated user management system where new users are registered and authenticated
fastify.get("/ws", { websocket: true }, (connection, req) => {
  const ws = connection.socket;
  clients.add(ws);

  // When a client disconnects, remove it from the clients set
  ws.on("close", () => {
    clients.delete(ws);
  });

  // When (on the server side) a message is received from a client, parse it and store it in the db and broadcast it to the others
  ws.on("message", (message) => {
    try {
      const parsed = JSON.parse(message);
      const { type } = parsed;
      console.log("Backend: Received message type:", type);

      if (type === "chat") {
        const { userId, content } = parsed;
        db.run("INSERT INTO messages (userId, content) VALUES (?, ?)", [
          userId,
          content,
        ]);
        // Send the message, which the client sent to all connected clients
        broadcaster(clients, ws, message);

      } else if (type === "join") {
        // Join a game room
        const { roomId, userId } = parsed;
        const room = getOrCreateRoom(roomId);
        room.addPlayer(userId, ws);
        // Response to the client, which side the player is on and the current state to render the initial game state
        const initialState = {
          side: room.players.get(ws).side,
          ...room.state,
        };
        ws.send(JSON.stringify({ type: "join", state: initialState }));

      } else if (type === "ready") {
        const { userId } = parsed;
        // Set the player as ready
        const room = rooms.get(ws._roomId);
        room.getPlayer(ws).ready = true;
        startGameLoop(room);
        console.log(`User ${userId} is ready`);

      } else if (type === "input") {
        console.log("Backend: Received input from client:", parsed);
        const { direction } = parsed;
        // The paddle position is updated => dir * speed / framerate (speed is 40 for now) / framerate (100ms for now)
        if (ws._side === "left")
          rooms.get(ws._roomId).state.p1Y += direction * 40 / 100;
        else if (ws._side === "right")
          rooms.get(ws._roomId).state.p2Y += direction * 40 / 100;
        // broadcaster(clients, ws, { type: "input", content: content });
      }
    } catch (e) {
      console.error("Invalid JSON received:", message);
      return;
    }
  });
});

// Start the Fastify server on port 3000 hosting on all interfaces
fastify.listen({ port: 3000, host: "0.0.0.0" }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info("Backend running on port 3000");
});

export function startGameLoop(room) {
  // If the game is already started, do nothing
  if (room.state.started) return;

  // If both players are ready, start the game
  if (room.players.size === 2 && Array.from(room.players.values()).every((p) => p.ready)) {
    room.state.started = true;
    // Initialize timestamp
    room.state.timestamp = Date.now();
    // Start the game loop, which updates the game state and broadcasts it to the players every 33ms
    room.loopInterval = setInterval(() => loop(room), 33);
  }
}

export function stopRoom(room, roomId) {
  // Destroy the room and stop the game loop
  if (room.loopInterval) clearInterval(room.loopInterval);
  rooms.delete(roomId);
}

// This function is called every 33ms to update the game state based on the current state and player input.
// Then broadcast it to the players, so that they can render the new state
export function loop(room) {
  // Update the ball position. New position += speed / framerate (speed is 50 for now) / framerate (33ms for now)

  // If ball > FIELD_H or ball < -FIELD_H, invert Y speed

  // If its a hit on the left side (ballX < -FIELD_W), check if ballY is within paddle range. If not score for right player and reset ball
  // If its a hit on the right side (ballX > FIELD_W), check if ballY is within paddle range. If not score for left player and reset ball

  // If it was in the paddle range, invert X speed and increase speed by 10%

  // broadcast the new state to the players
}