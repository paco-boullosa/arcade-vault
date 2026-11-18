// Resolución interna fija del canvas (el CSS lo escala al ancho disponible).
export const W = 800;
export const H = 600;

// Tablas por tamaño de asteroide (1, 2, 3). El índice 0 es relleno.
export const RADII = [0, 16, 30, 50]; // radio
export const SPEEDS = [0, 85, 55, 32]; // velocidad base, px/s
export const POINTS = [0, 100, 50, 20]; // puntos por destrucción

// Niveles
export const SAFE_DIST = 130; // px mínimos entre el centro y un asteroide nuevo

// Power-up: Disparo Triple
export const TRIPLE_DURATION = 10; // s de disparo triple
export const TRIPLE_SPREAD = 0.25; // rad (~14°) entre balas del abanico
export const POWERUP_WINDOW = 0.7; // fracción del nivel (en destrucciones) en la que puede aparecer
export const POWERUP_TTL = 8; // s antes de que el ítem desaparezca

// Escudo Temporal
export const SHIELD_DURATION = 5; // s de escudo activo
export const SHIELD_RADIUS = 24; // px, radio del círculo de energía
export const SHIELD_GRACE = 1; // s de invencibilidad tras absorber un golpe

// Límite del paso de tiempo por frame (s), evita saltos tras cambiar de pestaña.
export const MAX_DT = 0.05;
