import { GameStatus } from "../interfaces/GameInterfaces.js";

export class InputHandler {
	private keys:		Record<string, boolean> = {};
	private usedKeys:	string[] = ["w", "s", "ArrowUp", "ArrowDown", "W", "S"];
	private game:		GameStatus;

	constructor (game: GameStatus) {
		this.game = game;
		this.setUpEventListeners();
	}

	private setUpEventListeners() : void {
		const startButton = document.getElementById("startButton") as HTMLButtonElement;
		
		if (startButton) {
			startButton.addEventListener("click", () => {
				this.game.playing = true;
			});
		}

		document.addEventListener("keydown", (ev) => {
			if (this.usedKeys.includes(ev.key)) {
				this.keys[ev.key] = true;
			}
		});

		document.addEventListener("keyup", (ev) => {
			if (this.usedKeys.includes(ev.key)) {
				this.keys[ev.key] = false;
			}
		});
	}

	public getKeys() : { [key : string] : boolean } {
		return (this.keys);
	}
}
