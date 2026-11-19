export const W = 800;
export const H = 600;
export const CELL = 40;
export const COLS = W / CELL; // 20
export const ROWS = H / CELL; // 15

export const CFG = {
  startLength: 3,
  startX: 5, // cabeza inicial, mirando a la derecha
  startY: 7,
  pointsPerFruit: 10,
  fruitsPerLevel: 5,
  stepMs: 140, // intervalo entre pasos en el nivel 1
  stepMsDelta: 8, // se resta por nivel
  stepMsMin: 60,
  inputBuffer: 2, // giros en cola
};
