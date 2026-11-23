export const W = 800;
export const H = 600;
export const HUD_H = 40; // franja superior del HUD; el área de juego va de y = 40 a y = 600
export const PLAY_TOP = HUD_H;
export const PLAY_H = H - HUD_H; // 560

export const TERRAIN = {
  col: 20, // ancho de columna en px
  thickMin: 20, // grosor mínimo de techo y de suelo
  thickMax: 200,
  step: 12, // variación máxima de grosor entre columnas contiguas (px)
  flatStart: 600, // primeros 600 px de recorrido: techo y suelo planos de 40 px
  flatThick: 40,
  seed: 20261123, // semilla fija del terreno
};

export const SHIP = {
  w: 36, // tamaño dibujado
  h: 20,
  hitW: 24, // caja de colisión centrada
  hitH: 12,
  speed: 260, // px/s; la diagonal se normaliza
  minX: 20, // límites del centro de la nave
  maxX: 420,
  startX: 120,
  respawnInvulnMs: 2000,
};

export const SHOT = {
  w: 12,
  h: 4,
  speed: 640, // px/s hacia la derecha
  cooldownMs: 160, // autodisparo: 6,25 disparos/s
  max: 8, // disparos simultáneos en pantalla
};

export const ENEMY_BULLET = { r: 4, speed: 200, speedDelta: 10, speedMax: 300 };

export const SECTOR = {
  length: 3000, // px de recorrido por sector
  scroll: 120, // px/s en el sector 1
  scrollDelta: 10,
  scrollMax: 220,
  gapMin: 360, // hueco mínimo entre techo y suelo en el sector 1
  gapMinDelta: 20,
  gapMinFloor: 200,
};

export const WAVES = {
  every: 450, // px de recorrido entre oleadas
  first: 600, // primera oleada al recorrer 600 px
  quietBeforeGate: 600, // sin oleadas en los 600 px previos a la puerta
  quietAfterRespawn: 300, // sin oleadas en los 300 px siguientes a reaparecer
  seed: 4242, // semilla fija de las oleadas
};

export const GATE = {
  w: 30,
  hpBase: 4,
  hpPerSector: 2,
  hpMax: 14,
  pointsPerSector: 500,
  minXOnRespawn: 520,
};

export const CFG = {
  lives: 3,
  maxLives: 5,
  extraLifeEvery: 10000,
  distancePointPx: 10, // 1 punto por cada 10 px recorridos
  swarmBonus: 500,
  deathMs: 1200, // explosión; el mundo se congela
  dtMax: 0.05, // s
  scoreMax: 9999999,
};
