/*
/// <reference types="babylonjs" />
*/

import { GameManager } from './managers/index.js';

// Start the game - gameManager runs autonomously via render loop and event listeners
const _gameManager = new GameManager();

console.log("Pong Game Loaded! Have fun!");
