// Fuera de games.ts para que los componentes cliente puedan importarlo sin
// arrastrar el acceso a datos (que usa "use cache", solo servidor).
export const CATS = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
  "LABERINTO",
] as const;
