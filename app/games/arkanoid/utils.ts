import { CFG, LEVELS, ROW_COLORS, type BlockColor } from "./constants";

export type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
  hp: number; // golpes restantes
};

export type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
};

export type BlockHit =
  | { kind: "none" }
  | { kind: "bounce" } // bloque duro que aguanta: solo rebota
  | { kind: "break"; block: Block; points: number };

// levelIndex es el número de nivel (1..LEVELS.length)
export function createBlocks(levelIndex: number): Block[] {
  const B = CFG.block;
  const { mask, hardGray } = LEVELS[levelIndex - 1];
  const blocks: Block[] = [];
  for (let row = 0; row < B.rows; row++) {
    for (let col = 0; col < B.cols; col++) {
      if (!mask(row, col)) continue;
      const color = ROW_COLORS[row];
      blocks.push({
        x: B.offsetX + col * B.w,
        y: B.offsetY + row * B.h,
        w: B.w,
        h: B.h,
        color,
        alive: true,
        hp: hardGray && color === "gray" ? 2 : 1,
      });
    }
  }
  return blocks;
}

// Colisión bola-bloque. Muta `ball` (posición y velocidad) y `blocks`
// (hp y alive). Como máximo un bloque por llamada, para no invertir la bola
// dos veces. El efecto (sonido, explosión, puntos) lo aplica quien llama.
export function collideBlocks(
  ball: Ball,
  blocks: Block[],
  levelIndex: number,
): BlockHit {
  for (const blk of blocks) {
    if (!blk.alive) continue;
    const overlapX =
      Math.min(ball.x + ball.size, blk.x + blk.w) - Math.max(ball.x, blk.x);
    const overlapY =
      Math.min(ball.y + ball.size, blk.y + blk.h) - Math.max(ball.y, blk.y);
    if (overlapX <= 0 || overlapY <= 0) continue;

    // Se invierte el eje de menor penetración y se saca la bola del bloque
    if (overlapX < overlapY) {
      if (ball.x + ball.size / 2 < blk.x + blk.w / 2) ball.x -= overlapX;
      else ball.x += overlapX;
      ball.vx = -ball.vx;
    } else {
      if (ball.y + ball.size / 2 < blk.y + blk.h / 2) ball.y -= overlapY;
      else ball.y += overlapY;
      ball.vy = -ball.vy;
    }

    blk.hp--;
    if (blk.hp > 0) return { kind: "bounce" };

    const wasHard = blk.color === "gray" && LEVELS[levelIndex - 1].hardGray;
    blk.alive = false;
    return {
      kind: "break",
      block: blk,
      points: wasHard ? CFG.pointsPerHardBlock : CFG.pointsPerBlock,
    };
  }
  return { kind: "none" };
}
