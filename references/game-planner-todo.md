# Game Planner — TODO de propuestas

> Mantenido por el agente `game-planner`. No borrar filas: cambiar estado y añadir motivo.
> Estados: `Propuesto` · `Recomendado` · `Descartado` · `En spec` · `Implementado`.
> Encaje: suma de la rúbrica vigente (5 criterios × 1–5, máx. 25). `—` = aún sin evaluar.
> Nota 2026-11-19: la rúbrica vigente del agente tiene 5 criterios (Retro, Leaderboard, Técnica, Variedad, Originalidad), así que las evaluaciones se expresan sobre 25 hasta que se defina el 6.º criterio.

## Pendientes (Propuesto / Recomendado)

| Id     | Fecha      | Propuesto por | Juego         | Categoría | Encaje | Estado      | Nota                                                                                                                                                                  |
| ------ | ---------- | ------------- | ------------- | --------- | -----: | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GP-006 | 2026-11-19 | catálogo      | `invasores`   | SHOOTER   |  22/25 | Recomendado | 2026-11-19: siguiente juego recomendado. Shooter fijo por oleadas, puntuación clara, motor sencillo; aporta verde al catálogo real. Reutiliza id simulado.             |
| GP-007 | 2026-11-19 | catálogo      | `ranaria`     | ARCADE    |  20/25 | Propuesto   | 2026-11-19: alternativa 1. Buen encaje y color verde, pero sería el 3.er ARCADE real y la puntuación por avance/tiempo es menos limpia.                                |
| GP-008 | 2026-11-19 | catálogo      | `duelo-pixel` | VERSUS    |  19/25 | Propuesto   | 2026-11-19: categoría nueva, pero el modo 2 jugadores no encaja con el ranking; solo viable vs CPU con puntuación propia (p. ej. puntos por rally). Baja prioridad.   |
| GP-005 | 2026-11-19 | catálogo      | `gloton`      | ARCADE    |  18/25 | Propuesto   | 2026-11-19: alternativa 2. Gran leaderboard, pero IA de perseguidores y laberinto elevan la complejidad; ARCADE+amarillo ya repetidos y riesgo de parecerse a Pac-Man. |
| GP-009 | 2026-11-19 | usuario | `autopista-neon` | CARRERAS | 24/25 | Propuesto | Carretera infinita con scroll vertical, near-miss y motor AABB trivial. Mejor puntuación de la tanda. Requiere ampliar `GameCategory`/`CATS` y `games_cat_check` (CARRERAS). Magenta. |
| GP-010 | 2026-11-19 | usuario | `tuberia` | PUZZLE | 23/25 | Propuesto | Colocar tuberías antes de que llegue el fluido; partidas de 2–4 min. Verde. No usar nombre/arte de Pipe Mania. Sin cambios de esquema. |
| GP-011 | 2026-11-19 | usuario | `torre` | PLATAFORMAS | 23/25 | Propuesto | Escalador vertical sin fin con combo por pisos. Requiere categoría PLATAFORMAS (migración + tipo). Magenta. |
| GP-012 | 2026-11-19 | usuario | `detector` | ESTRATEGIA | 22/25 | Propuesto | Deducción de minas en rejilla con tableros encadenados; primer clic siempre seguro. Requiere categoría ESTRATEGIA. Cyan. No usar "Buscaminas". |
| GP-013 | 2026-11-19 | usuario | `arena-neon` | SHOOTER | 22/25 | Propuesto | Twin-stick en arena con multiplicador. 2.º SHOOTER real, sin cambios de esquema. Magenta. Evitar estética Geometry Wars. Sugerido tras `invasores`. |
| GP-014 | 2026-11-19 | usuario | `torreta` | SHOOTER | 22/25 | Propuesto | Torreta fija a 360° con bomba de pantalla; motor más simple. Amarillo ya saturado. |
| GP-015 | 2026-11-19 | usuario | `esquivo` | ARCADE | 22/25 | Propuesto | Bullet-hell de solo esquivar, puntos por tiempo y roces. Cyan. Ajustar dificultad. |
| GP-016 | 2026-11-19 | usuario | `penaltis` | DEPORTES | 22/25 | Propuesto | Tanda de penaltis infinita vs CPU. Requiere categoría DEPORTES. Verde. Sin equipos ni marcas reales. |
| GP-017 | 2026-11-19 | usuario | `trazo` | LABERINTO | 22/25 | Propuesto | Pintar raíles de una rejilla con enemigos de patrulla fija. Requiere categoría LABERINTO. Cyan. Se distingue de `gloton`. |
| GP-018 | 2026-11-19 | usuario | `banderas` | LABERINTO | 22/25 | Propuesto | Coche en laberinto grande con cámara, radar y rivales. Requiere LABERINTO. Verde. Complejidad técnica media (T=3). |
| GP-019 | 2026-11-19 | usuario | `horizonte` | SHOOTER | 21/25 | Propuesto | Shoot'em up de scroll lateral; más contenido (terreno, patrones). Cyan. Evitar elementos de Gradius/R-Type. |
| GP-020 | 2026-11-19 | usuario | `corredor` | ARCADE | 20/25 | Propuesto | Endless runner con salto doble. Verde (sin estilo propio en `GameCard`). No parecerse al dinosaurio de Chrome. |
| GP-021 | 2026-11-19 | usuario | `vuelta-rapida` | CARRERAS | 20/25 | Propuesto | Circuito cenital contra reloj; convertir tiempo a puntos. Física de derrape costosa. Requiere CARRERAS. |
| GP-022 | 2026-11-19 | usuario | `minigolf` | DEPORTES | 20/25 | Propuesto | 9 hoyos con rebotes; convertir golpes a puntos. Partida larga (4–6 min). Requiere DEPORTES. |
| GP-023 | 2026-11-19 | usuario | `tacada` | DEPORTES | 20/25 | Propuesto | Billar en solitario con 10 tiros. Mayor riesgo técnico (física de muchas bolas). Requiere DEPORTES. |
| GP-024 | 2026-11-19 | usuario | `desactivador` | PLATAFORMAS | 20/25 | Propuesto | Plataformas de una pantalla, recoger bombas. Necesita niveles hechos a mano. Amarillo saturado. |
| GP-025 | 2026-11-19 | usuario | `boveda` | LABERINTO | 20/25 | Propuesto | Sigilo con guardias y cono de visión; la más original pero menos arcade. Magenta. |
| GP-026 | 2026-11-19 | usuario | `burbujas` | PUZZLE | 19/25 | Propuesto | Disparar burbujas de color. Rejilla hexagonal y rebotes (T=3). Evitar Puzzle Bobble. Magenta. |
| GP-027 | 2026-11-19 | usuario | `baluarte` | ESTRATEGIA | 19/25 | Propuesto | Defensa de torres en una pantalla, ~10 oleadas. Riesgo de alcance y equilibrio. Verde. |
| GP-028 | 2026-11-19 | usuario | `cristales` | PUZZLE | 19/25 | Propuesto | Match-3 contrarreloj de 90 s. Menos retro; animaciones de cascada. Evitar estilo Bejeweled. Magenta. |

## En curso (En spec)

_Ninguna._

## Implementados

| Id     | Fecha      | Juego       | Spec                                   |
| ------ | ---------- | ----------- | -------------------------------------- |
| GP-001 | 2026-11-19 | `asteroids` | `specs/05-asteroids-game-integration.md` |
| GP-002 | 2026-11-19 | `tetris`    | `specs/07-tetris-game-integration.md`    |
| GP-003 | 2026-11-19 | `arkanoid`  | `specs/08-arkanoid-game-integration.md`  |
| GP-004 | 2026-11-19 | `snake`     | `specs/09-snake-game-integration.md`     |

## Descartados (con motivo)

| Id     | Fecha      | Juego                | Motivo                                                                  |
| ------ | ---------- | -------------------- | ----------------------------------------------------------------------- |
| GP-029 | 2026-11-19 | Squash en solitario  | Duplica `duelo-pixel` (Pong, GP-008) y `arkanoid` (Breakout, GP-003).   |
