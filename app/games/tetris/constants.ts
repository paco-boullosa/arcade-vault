// Constantes del original (game.js), sin cambios de valor.
export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30; // tablero 300×600
export const LINE_SCORES = [0, 100, 300, 500, 800];
export const POWER_EVERY = 5; // líneas entre power-ups
export const FREEZE_MS = 5000;
export const WILD_MS = 400;
export const FLASH_MS = 800;
export const GARBAGE_EVERY = 10000; // ms
export const TIME_LIMIT = 120000; // ms

// Índices de color especiales del tablero (1–7 son las piezas).
export const GRAY = 8; // basura y bloques fijos de los desafíos
export const WILD = 9; // comodín del power-up Tinte

// Intentos horizontales al rotar (no es SRS).
export const KICKS = [0, -1, 1, -2, 2];

// Resolución interna del canvas y disposición.
export const W = 800;
export const H = 600;
export const BOARD_X = 40; // tablero 300×600 a la izquierda
export const PANEL_X = 380; // panel lateral

// Límite del CHECK de la tabla `scores`.
export const MAX_SCORE = 9_999_999;
