import { Speed, GameSettings } from "../interfaces/GameInterfaces.js";

export class GameConfig {
	public static readonly FIELD_WIDTH = 100;
	public static readonly FIELD_HEIGHT = 40;
	public static readonly PADDLE_RATIO = 1/6;

	private static settings: GameSettings = {
		difficulty:		'MEDIUM',
		opponent:		'PERSON',
		player_one_ai:	false,
		player_two_ai:	false
	};

	public static get ballSpeed() : Speed {
		const base = { hspd: (Math.random() < 0.5 ? this.FIELD_WIDTH : -this.FIELD_WIDTH) / 150,
			vspd: (Math.random() < 0.5 ? this.FIELD_HEIGHT : -this.FIELD_HEIGHT) / 150};
		const multiplier = this.getDifficultyMultiplier();
		return { hspd: base.hspd * multiplier, vspd: base.vspd * multiplier };
	}

	public static get paddleSize() : number {
		return (this.FIELD_HEIGHT * this.PADDLE_RATIO);
	}
	
	public static get paddleSpeed() : number {
		return (this.FIELD_HEIGHT / 100);
	}
	
	private static getDifficultyMultiplier(): number {
		switch (this.settings.difficulty) {
			case 'EASY':	return (0.7);
			case 'MEDIUM':	return (1.0);
			case 'HARD':	return (1.4);
		}
	}

	public static setDifficulty(difficulty: 'EASY' | 'MEDIUM' | 'HARD') {
		this.settings.difficulty = difficulty;
	}
	
	public static getDifficulty() {
		return this.settings.difficulty;
	}

	public static setOpponent(opponent: 'PERSON' | 'REMOTE' | 'AI') {
		this.settings.opponent = opponent;
	}
	
	public static getOpponent() {
		return this.settings.opponent;
	}
}