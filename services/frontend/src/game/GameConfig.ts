import { Speed, GameSettings } from "../interfaces/GameInterfaces.js";

export type WorldConfig = { FIELD_WIDTH: number; FIELD_HEIGHT: number; PADDLE_RATIO: number; PADDLE_ACC: number; };

// fieldWidth: 100,
// fieldHeight: 40,
// paddleRatio: 1/6,
// paddleAcc: 0.2,

export class GameConfig {
	private static	FIELD_WIDTH = 100;
	private static	FIELD_HEIGHT = 40;
	private static	PADDLE_RATIO = 1/6;
	private static	PADDLE_ACC = 0.2;

	private static settings: GameSettings = {
		ai_difficulty:	'HARD',
		opponent:		'REMOTE'
	};

	public static get ballSpeed() : Speed {
		const base = { hspd: (Math.random() < 0.5 ? this.FIELD_WIDTH : -this.FIELD_WIDTH) / 150,
			vspd: (Math.random() < 0.5 ? this.FIELD_HEIGHT : -this.FIELD_HEIGHT) / 150};
		return { hspd: base.hspd, vspd: base.vspd };
	}

	public static get paddleSize() : number {
		return (this.FIELD_HEIGHT * this.PADDLE_RATIO);
	}
	
	public static get paddleSpeed() : number {
		return (this.FIELD_HEIGHT / 100);
	}

	public static setAiDifficulty(difficulty: 'EASY' | 'MEDIUM' | 'HARD') {
		this.settings.ai_difficulty = difficulty;
	}
	
	public static get getAiDifficulty() {
		return (this.settings.ai_difficulty);
	}

	public static setOpponent(opponent: 'PERSON' | 'REMOTE' | 'AI') {
		this.settings.opponent = opponent;
	}
	
	public static get getOpponent() {
		return (this.settings.opponent);
	}

	public static getConfig(): WorldConfig {
		return {
			FIELD_WIDTH: this.FIELD_WIDTH,
			FIELD_HEIGHT: this.FIELD_HEIGHT,
			PADDLE_RATIO: this.PADDLE_RATIO,
			PADDLE_ACC: this.PADDLE_ACC,
		}
	};

	public static setConfig(cfg: WorldConfig) {
		this.FIELD_WIDTH = cfg.FIELD_WIDTH;
		this.FIELD_HEIGHT = cfg.FIELD_HEIGHT;
		this.PADDLE_RATIO = cfg.PADDLE_RATIO;
		this.PADDLE_ACC = cfg.PADDLE_ACC;
	}
}