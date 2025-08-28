// export const WORLD_CONFIG = {
// 	FIELD_WIDTH: 100,
// 	FIELD_HEIGHT: 40,
// 	PADDLE_RATIO: 1/6,
// 	PADDLE_ACC: 0.2,
// };

export class WORLD_CONFIG {

	static ball = {

	}
	static config = {
		FIELD_WIDTH: 100,
		FIELD_HEIGHT: 40,
		PADDLE_RATIO: 1/6,
		PADDLE_ACC: 0.2,
	};

	static settings = {
		ai_difficulty: 'MEDIUM', // EASY, MEDIUM, HARD
		opponent: 'PERSON', // PERSON, REMOTE, AI
	};

	static get ballSpeed() {
		const base = { hspd: (Math.random() < 0.5 ? this.FIELD_WIDTH : -this.FIELD_WIDTH) / 150,
			vspd: (Math.random() < 0.5 ? this.FIELD_HEIGHT : -this.FIELD_HEIGHT) / 150};
		return { hspd: base.hspd, vspd: base.vspd };
	}

	static get paddleSize() {
		return (this.FIELD_HEIGHT * this.PADDLE_RATIO);
	}

	static get paddleSpeed() {
		return (this.FIELD_HEIGHT / 70);
	}

	static get FIELD_WIDTH() {
		return this.config.FIELD_WIDTH;
	}

	static get FIELD_HEIGHT() {
		return this.config.FIELD_HEIGHT;
	}

	static get PADDLE_RATIO() {
		return this.config.PADDLE_RATIO;
	}

	static get PADDLE_ACC() {
		return this.config.PADDLE_ACC;
	}

	static get aiDifficulty() {
		return (this.settings.ai_difficulty);
	}

	static get opponent() {
		return (this.settings.opponent);
	}

	static setAiDifficulty(difficulty) {
		this.settings.ai_difficulty = difficulty;
	}

	static setOpponent(opponent) {
		this.settings.opponent = opponent;
	}

}
