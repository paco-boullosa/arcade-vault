export const W = 800;
export const H = 600;
export const CELL = 40;
export const COLS = W / CELL; // 20
export const ROWS = H / CELL; // 15

export const ROW_GOAL = 0;
export const ROW_RIVER_TOP = 1; // filas 1..5 = río
export const ROW_RIVER_BOTTOM = 5;
export const ROW_MEDIAN = 6;
export const ROW_ROAD_TOP = 7; // filas 7..13 = carretera
export const ROW_ROAD_BOTTOM = 13;
export const ROW_START = 14;

export const CFG = {
  startCol: 9, // x = 360
  lives: 3,
  hopMs: 90, // animación del salto; durante ella no se acepta otra pulsación
  frogHit: 28, // caja de colisión de la rana (cuadrada, centrada en la celda)
  vehicleHitH: 32, // alto de la caja de un vehículo (centrada en la fila)
  timeMs: 30000, // tiempo por rana en el nivel 1
  timeMsDelta: 2000, // se resta por nivel
  timeMsMin: 20000,
  deathMs: 900, // animación de muerte
  levelClearMs: 1500, // pausa al llenar las 5 casillas
  pointsRow: 10, // por cada fila nueva alcanzada (primera vez por rana)
  pointsHome: 50,
  pointsTimePerSecond: 10, // por segundo entero restante al llegar a casilla
  pointsLevelClear: 1000,
  maxScore: 9999999, // CHECK de `scores`
  speedPerLevel: 0.15, // +15 % de velocidad por nivel
  speedMax: 2, // tope del multiplicador
  diveCycleMs: 6000,
  diveWarnFrom: 3800,
  diveSubFrom: 4400,
  diveSubTo: 5600,
};

// Casillas de meta (fila 0): 5 huecos de 2 celdas (80 px)
export const HOMES = [1, 5, 9, 13, 17]; // columna izquierda de cada hueco (x = col × 40)
export const HOME_W = 80;
