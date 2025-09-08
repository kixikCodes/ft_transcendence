import Fastify from "fastify";
import sqlite3 from "sqlite3";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { getOrCreateRoom, rooms } from "./gameRooms.js";
import { initDb } from "./initDatabases.js";
import { broadcaster } from "./utils.js";
import { buildWorld, movePaddles, moveBall } from "@app/shared";
// import * as Shared from "@app/shared";
// or import specific identifiers, e.g.:
// import { Config } from "@app/shared";

// import { startGameLoop } from "./game.js";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret"; // Temporary, use env vars
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";

// Helpers for signing access and refresh Json Web Tokens
function signAccessToken(user) {
	return jwt.sign(
		{ sub: user.id, username: user.username },
		JWT_SECRET,
		{ expiresIn: ACCESS_TOKEN_TTL }
	);
}

function signRefreshToken(user) {
	return jwt.sign(
		{ sub: user.id, username: user.username, type: "refresh" },
		JWT_SECRET,
		{ expiresIn: REFRESH_TOKEN_TTL }
	);
}

// Helpers for automated 2FA emails
const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: 587,
	secure: false,
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASS
	}
});

async function sendOTPEmail(to, code) {
	await transporter.sendMail({
		from: '"ft_transcendence" <no-reply@transcendence.com>',
		to,
		subject: "Your one time 2FA code",
		text: `Your 2FA Verification Code is: ${code}`
	});
}

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

fastify.get("/users", (request, reply) => {
  db.all("SELECT * FROM users", [], (err, rows) => {
    if (err) {
      reply.code(500).send({ error: err.message });
    } else {
      reply.send(rows);
    }
  });
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

fastify.post("/api/register", (request, reply) => {
	const { username, email, password } = request.body;

	if (!username || !email || !password)
		return reply.code(400).send({ error: "Missing fields" });

	const salt = bcrypt.genSaltSync(15); // Salt Password
	const hash = bcrypt.hashSync(password, salt); // Hash salted Password
	db.run(
		"INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
		[username, email, hash],
		function (err) {
			if (err) {
				if (err.message.includes("UNIQUE")) {
					return reply
					.code(400)
					.send({ error: "Username or email already taken" });
				}
				return reply.code(500).send({ error: err.message });
			}
			reply.send({ id: this.lastID, username, email });
		}
	);
});

fastify.post("/api/login", (request, reply) => {
	const { username, password } = request.body;

	if (!username || !password)
		return reply.code(400).send({ error: "Missing fields" });

	db.get(
		"SELECT * FROM users WHERE username = ?",
		[username],
		(err, user) => {
			if (err)
				return reply.code(500).send({ error: err.message });
			if (!user)
				return reply.code(400).send({ error: "Invalid credentials" });
			// Authenticate password
			const isValid = bcrypt.compareSync(password, user.password_hash);
			if (!isValid)
				return reply.code(400).send({ error: "Invalid credentials" });
			
			// Gegenerate 2FA code and store in DB
			const OTPcode = Math.floor(100000 + Math.random() * 900000).toString();
			const expiresAt = Date.now() + 5 * 60 * 100; // 5 mins from now
			db.run("UPDATE users SET otp_code = ?, otp_expires = ? WHERE id = ?", [OTPcode, expiresAt, user.id]);
			// Send 2FA Email with code
			try {
				sendOTPEmail(user.email, OTPcode);
			} catch (e) {
				console.error(`Failed to end email to ${user.email}`, e);
				return reply.code(500).send({ error: "Failed to send OTP" });
			}
			// Issue temporary JWT
			const tempToken = jwt.sign(
				{ sub: user.id, stage: "mfa" },
				JWT_SECRET,
				{ expiresIn: "5m" }
			);
			// ALWAYS require 2FA!
			reply.send({ mfa_required: true, tempToken });
		}
	);
});

// Two Factor Athentication
fastify.post("/api/verify-2fa", (request, reply) => {
	const { code, tempToken } = request.body;
	if (!code || !tempToken) {
		return reply.code(400).send({ error: "Missing fields" });
	}

	let payload;
	try {
		payload = jwt.verify(tempToken, JWT_SECRET);
	} catch (e) {
		return reply.code(401).send({ error: "Invalid or expired token" });
	}

	db.get(
		"SELECT * FROM users WHERE id = ?",
		[payload.sub],
		(err, user) => {
			if (err)
				return reply.code(500).send({ error: err.message });
			if (!user)
				return reply.code(400).send({ error: "User not found" });
			// Compare input code with stored 2FA code and clear from DB once verified
			if (user.otp_code !== code || Date.now() > user.otp_expires) {
				return reply.code(400).send({ error: "Invalid or expired 2FA code" });
			}
			db.run("UPDATE users SET otp_code = NULL, otp_expires = NULL WHERE id = ?", [user.id]);
			// Issue proper JWT and create session cookie
			const accessToken = signAccessToken(user);
			const refreshToken = signRefreshToken(user);
			reply.setCookie("refreshToken", refreshToken, {
				httpOnly: true,
				sameSite: "lax",
				secure: true,
				path: "/",
				maxAge: 7 * 24 * 3600
			});

			reply.send({
				accessToken,
				user: { id: user.id, username: user.username, email: user.email }
			});
		}
	);
});

// Start the Fastify server on port 3000 hosting on all interfaces
fastify.listen({ port: 3000, host: "0.0.0.0" }, (err) => {
	if (err) {
		fastify.log.error(err);
		process.exit(1);
	}
	fastify.log.info("Backend running on port 3000");
});

export function startLoop(room) {
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

export function stopRoom(room, roomId) {
  // Destroy the room and stop the game loop
  if (room.loopInterval) clearInterval(room.loopInterval);
  rooms.delete(roomId);
}

// This function is called every 33ms to update the game state based on the current state and player input.
// Then broadcast it to the players, so that they can render the new state
export function loop(room) {

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
