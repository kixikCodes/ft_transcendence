import { GameStatus, GameScene } from "../interfaces/GameInterfaces.js";
import {
  GameConfig,
  GameLogic,
  PaddleLogic,
  SceneBuilder,
} from "../game/index.js";
import { InputHandler } from "./InputHandler.js";

export class GameManager {
  private gameStatus!: GameStatus;
  private inputHandler!: InputHandler;
  private gameLogic!: GameLogic;
  private sceneBuilder!: SceneBuilder;
  private scene!: GameScene;
  private paddleLogic!: PaddleLogic;

  //   p1Y: number,
  //   p2Y: number,
  //   ballX: number,
  //   ballY: number,
  //   scoreL: number,
  //   scoreR: number,
  //   started: boolean,

// this.gameStatus = {
// 	p1Score:	0,
// 	p2Score:	0,
// 	running:	true,
// 	playing:	false
// };


  constructor() {
    this.initialize();
  }

  public async initialize() {
    // Initialize the game status by fetching the initial state from the server to ensure that the game state is consistent between server and client
    await this.init_game_status();
    // Initialize the input handler to manage user inputs. It listens for user actions and updates the given status object accordingly
	// The input handler is also responsible for sending input data to the server in case of remote
    this.inputHandler = new InputHandler(this.gameStatus);
	// Initialize the scene builder to create and manage the 3D scene using Babylon.js
    this.sceneBuilder = new SceneBuilder("gameCanvas");
	// Create the 3D scene and store it in the scene property
    this.scene = this.sceneBuilder.createScene();

	// GameLogic: Updates paddles with PaddleLogic and the ball (in case of local players).
	// And updates the scores texture on the game map
	// send the scene for accessing the game objects (ball/paddles)
	// send the game status for accessing scores
	// send the input handler's keys for processing user inputs
    this.gameLogic = new GameLogic(
      this.scene,
      this.gameStatus,
      this.inputHandler.getKeys()
    );
	
	// Paddle logic in case of local players (move paddles based on user input or AI)
	// send the scene for accessing ball/paddles objects
	// gameStatus (scores/running/playing) has currently no use in PaddleLogic
	// send the input handlers key object for processing user inputs to move the paddles
    this.paddleLogic = new PaddleLogic(
      this.scene,
      this.gameStatus,
      this.inputHandler.getKeys()
    );

	// Link the gamelogic to the paddlelogic to access the updateBall() function
    this.paddleLogic.setGameLogic(this.gameLogic);
	// Link the paddlelogic to the gamelogic to access the paddle control functions
    this.gameLogic.setPaddleLogic(this.paddleLogic);
    this.setUpEventListeners();
	// Start the game loop which updates the game state and renders the scene
    this.startGameLoop();
  }

  private async init_game_status(): Promise<void> {
    try {
      const res = await fetch("http://localhost:3000/initState", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
	  const initState = await res.json();
	  this.gameStatus = {
		p1Score: initState.scoreL || 0,
		p2Score: initState.scoreR || 0,
		running: true,
		playing: initState.started || false,
	  };
	  return;
    }
	catch (err) {
      console.error("Failed to initialize game status:", err);
      this.gameStatus = {
        p1Score: 0,
        p2Score: 0,
        running: true,
        playing: false,
      };
      return;
    }
  }

  private setUpEventListeners(): void {
    window.addEventListener("resize", () => {
      this.sceneBuilder.getEngine().resize();
    });

    //	Handle page unload/refresh/close
    window.addEventListener("beforeunload", () => {
      this.cleanup();
    });

    //	Backup for older browsers or different scenarios
    window.addEventListener("unload", () => {
      this.cleanup();
    });

    //	Handle page visibility changes (when user switches tabs)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        //	Pause the game
        console.log("Page hidden - consider pausing game");
      } else {
        //	Resume the game
        console.log("Page visible again");
      }
    });
  }

  private startGameLoop(): void {
    this.sceneBuilder.getEngine().runRenderLoop(() => {
      // Running is set on true, if the game engine is alive
      if (!this.gameStatus.running) return;
      // If both players are ready.
      // In case of a remote player, it is ready, if 2 joined the room and clicked on ready.
      // update() handles the physics (paddles/ball) of non-remote players and Updates the score texture on the game map
      // If its a remote player, the physics comes from the server.
      if (this.gameStatus.playing) this.gameLogic.update();
      // Here the scene will be rendered again
      this.scene.render();
    });
  }

  private cleanup(): void {
    console.log("Cleaning up game resources...");

    //	Clean scene objects
    if (this.scene && !this.scene.isDisposed) this.scene.dispose();

    //	CLean engine
    if (
      this.sceneBuilder.getEngine() &&
      !this.sceneBuilder.getEngine().isDisposed
    )
      this.sceneBuilder.getEngine().dispose();

    //	End game
    this.gameStatus.running = false;
  }

  // Function which is triggered, when the server sends a state update (in case of remote players)
  public applyServerState(s: {
    p1Y: number;
    p2Y: number;
    ballX: number;
    ballY: number;
    scoreL: number;
    scoreR: number;
    started: boolean;
  }) {
    this.scene.paddle1.position.z = s.p1Y;
    this.scene.paddle2.position.z = s.p2Y;
    this.scene.ball.position.x = s.ballX;
    this.scene.ball.position.z = s.ballY;
    this.gameStatus.p1Score = s.scoreL;
    this.gameStatus.p2Score = s.scoreR;
    this.gameStatus.playing = s.started;
  }

  public getInputHandler(): InputHandler {
    return this.inputHandler;
  }
}
