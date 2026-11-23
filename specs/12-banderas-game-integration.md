# SPEC 12 — Juego BANDERAS integrado con su leaderboard

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 10
> **Date:** 2026-11-23
> **Objective:** Crear `banderas`, un juego de coche por un laberinto de 41×31 casillas con cámara que sigue al coche, en el que hay que izar los 8 mástiles de cada ronda manteniéndose 1 s sobre ellos mientras unos vigías patrullan y te persiguen en línea recta, con 3 vidas, como motor TypeScript con canvas único 800×600 y ranking en Supabase.

---

## Por qué existe este spec

El usuario eligió la variante A (`specs/game-jam/banderas/01-banderas-izado-vigias.md`), que este spec renumera sin cambiar las reglas. Es el resultado de la game jam con el tema GP-018 del TODO del `game-planner` (`banderas`, LABERINTO, 22/25): "coche en laberinto grande con cámara, radar y rivales. Requiere LABERINTO. Verde. Complejidad técnica media (T=3)". Sería el primer juego de la categoría LABERINTO y el séptimo con motor real (Asteroides, Tetris, Arkanoid, Snake, Frogger y Horizonte ya existen), y reutiliza el leaderboard genérico de SPEC 06 y la `GameDefinition` de SPEC 07 (con el campo `touch` de SPEC 10). No hay código de referencia: las reglas se definen aquí, como en SPEC 09.

La nota del TODO describe, casi tal cual, la combinación de un clásico concreto del género (coche que recoge banderas en un laberinto con scroll, minimapa de radar, combustible, humo y coches que le persiguen). Este spec **no** la recrea. Se descartan expresamente: el minimapa de radar continuo, el depósito de combustible, la pantalla de humo, las rocas, las banderas que se recogen al pasar con bonus de nivel y los coches perseguidores con IA de camino mínimo. En su lugar el diseño propio es:

- Las banderas se **izan**: hay que permanecer 1 s sobre el mástil, lo que obliga a elegir cuándo pararse.
- Los rivales son **vigías** que patrullan por azar y solo persiguen en línea recta si te ven; no calculan caminos.
- Sin combustible: la presión es la de los vigías y un tiempo de bonificación (par), no un depósito.
- Una **brújula** (flecha y distancia al mástil más cercano) sustituye al radar; el mapa no se dibuja entero.
- El laberinto se genera por semilla, con bucles, y cada ronda es uno nuevo; ningún mapa procede de otro juego.

El título, el id (`banderas`, el de la propuesta GP-018), los vigías, los mástiles y el aspecto neón con formas del canvas son propios. Esta variante es la clásica: 3 vidas, izado y vigías, sin límite de tiempo duro. La variante B comparte id, título, categoría, color, laberinto, coche y fila de `games`, pero cambia la mecánica (contrarreloj con niebla, rivales que compiten por las banderas, sonar y racha, sin vidas).

No hay assets en `references/source-assets/` para este juego (solo existe `snake-assets/`), así que todo se dibuja con formas del canvas y no hay sonido.

---

## Alcance

**Dentro:**

- Motor en `app/games/banderas/` (TypeScript puro, sin React, sin estado global).
- Laberinto de 41×31 casillas de 40 px (1640×1240 px) generado por semilla (recorrido en profundidad más 40 bucles), nuevo en cada ronda, con cámara que sigue al coche en un visor de 800×560 px.
- Coche con movimiento en 4 direcciones (una a la vez), colisión por píxeles contra los muros y ayuda de giro.
- 8 mástiles por ronda; se iza uno ocupándolo 1,0 s.
- Vigías (3 en la ronda 1, hasta 7) con patrulla aleatoria, visión en línea recta y persecución recta.
- 3 vidas, vida extra cada 5.000 puntos (máximo 5), invulnerabilidad de 2 s al reaparecer.
- Puntuación por mástil, por ritmo y por completar la ronda con tiempo par restante.
- Brújula en el HUD del canvas.
- Pantallas del canvas: inicio (`Pulsa ESPACIO para arrancar`), `PAUSA`, `Ronda superada` y `Game over`.
- Entrada en `ENGINES` con la clave `banderas`.
- **Categoría nueva `LABERINTO`**: migración que amplía `games_cat_check`, cambio de `GameCategory` en `app/data/games.ts` y de `CATS` en `app/data/categories.ts`.
- Fila `banderas` en `games` mediante una migración nueva y portada CSS `.cover-banderas`, hecha con `/frontend-design`.
- Guardado en `scores` con `game_id = 'banderas'`.

**Fuera de alcance (para otros specs):**

- Sonido (no hay assets y no se inventa).
- Minimapa de radar, combustible, humo, rocas y cualquier extra de arma o de velocidad.
- Skins: las añade el agente `skin-designer` al terminar la implementación (`/spec-impl-game`).
- Ajuste fino del mando táctil: lo hace el agente `mobile-porter` (SPEC 10). Aquí solo se deja una entrada `touch` mínima para que el tipo compile.
- Mapas dibujados a mano y editor de laberintos.
- Récords locales: el ranking es `scores`.
- Escalado por `devicePixelRatio`.
- Dos jugadores.
- Anti-trampas y tests automatizados (no hay runner).
- Color nuevo: se usa `green`, que ya existe en `GameColor` y en `games_color_check`.

---

## Modelo de datos

Constantes (`app/games/banderas/constants.ts`), definidas aquí porque no hay original:

```ts
export const W = 800;
export const H = 600;
export const HUD_H = 40; // franja superior del HUD; el visor va de y = 40 a y = 600
export const VIEW_H = H - HUD_H; // 560

export const TILE = 40;
export const ROOMS_X = 20; // salas en horizontal
export const ROOMS_Y = 15;
export const COLS = 2 * ROOMS_X + 1; // 41 casillas
export const ROWS = 2 * ROOMS_Y + 1; // 31
export const MAP_W = COLS * TILE; // 1640 px
export const MAP_H = ROWS * TILE; // 1240 px
export const CAM_MAX_X = MAP_W - W; // 840
export const CAM_MAX_Y = MAP_H - VIEW_H; // 680

export const MAZE = {
  seedBase: 18018, // semilla de la ronda r = seedBase + r
  extraLoops: 40, // muros interiores que se abren tras el árbol
  startRoom: { i: 10, j: 7 }, // sala de salida (casilla 21, 15)
};

export const CAR = {
  size: 24, // caja de colisión y dibujo (cuadrado)
  speed: 200, // px/s
  turnAssist: 14, // px de tolerancia para alinear un giro
  startX: 860, // centro de la sala de salida
  startY: 620,
  respawnInvulnMs: 2000,
};

export const MAST = {
  perRound: 8,
  holdRadius: 16, // px: el centro del coche debe estar a esta distancia del mástil
  holdSec: 1.0,
  minBfs: 10, // pasos de sala mínimos desde la salida
  minPair: 6, // distancia Manhattan mínima entre mástiles (en salas)
  minPairFloor: 3,
};

export const GUARD = {
  size: 24,
  base: 2, // vigías = min(max, base + ronda)
  max: 7,
  patrolSpeed: 100, // ronda 1
  patrolDelta: 10,
  patrolMax: 150,
  chaseExtra: 40, // persecución = patrulla + 40 (máx. 190 < 200)
  sightPx: 320, // alcance de visión (8 casillas)
  sightBand: 12, // desalineación lateral máxima para verte
  confusedSec: 1.5,
  minBfs: 12, // pasos de sala mínimos desde la salida
  minPair: 3,
};

export const SCORE = {
  mast: 200,
  rhythmBonus: 100, // si se iza a ≤ 20 s del anterior (o del inicio de la ronda)
  rhythmSec: 20,
  roundBase: 500,
  roundPerParSec: 10,
  extraLifeEvery: 5000,
  max: 9999999,
};

export const CFG = {
  lives: 3,
  maxLives: 5,
  parBase: 150, // s en la ronda 1
  parDelta: 10, // se resta por ronda
  parMin: 90,
  deathMs: 1200,
  clearMs: 2000,
  dtMax: 0.05, // s
};
```

Convenciones:

- Coordenadas de casilla: origen arriba a la izquierda, `x` de 0 a 40 y `y` de 0 a 30. Coordenadas de sala: `i` de 0 a 19 y `j` de 0 a 14; la sala `(i, j)` es la casilla `(2i + 1, 2j + 1)`. Los muros ocupan las casillas pares o el borde.
- Coordenadas de mundo en px: la casilla `(x, y)` ocupa `[40x, 40x + 40) × [40y, 40y + 40)`. El centro de la sala `(i, j)` es `(80i + 60, 80j + 60)`.
- Cámara: `camX = clamp(carX - 400, 0, 840)`, `camY = clamp(carY - 280, 0, 680)`. El mundo se dibuja desplazado `(-camX, HUD_H - camY)` con recorte al visor `(0, 40, 800, 560)`. Sin suavizado.
- Casillas dibujadas por frame: `(20 + 1) × (14 + 1) = 315` como máximo.
- Ronda `r` (empieza en 1): semilla del laberinto `18018 + r`; semilla de colocación `(18018 + r) × 2 + 1`.

### Generación del laberinto (`maze.ts`, funciones puras)

PRNG `mulberry32(seed)`. Toda la casilla empieza como muro.

1. **Árbol.** Recorrido en profundidad iterativo desde la sala `(0, 0)`. En cada paso se listan los vecinos no visitados en el orden N, E, S, O; si hay alguno se elige el índice `floor(rng() × n)`, se abre la casilla de la sala vecina y la casilla de conexión, y se apila; si no hay, se desapila. Abre `300 − 1 = 299` conexiones.
2. **Bucles.** Se listan las conexiones aún cerradas (primero la del este y luego la del sur de cada sala, en orden `j`, `i`), se barajan con Fisher–Yates (`j = floor(rng() × (k + 1))`, de atrás adelante) y se abren las 40 primeras.
3. Resultado: `299 + 40 = 339` conexiones, `300 + 339 = 639` casillas transitables y `1271 − 639 = 632` muros. Las casillas de borde (`x = 0`, `x = 40`, `y = 0`, `y = 30`) son siempre muro.

Conexidad: el paso 1 es un árbol que visita las 300 salas, así que todas son alcanzables desde cualquiera; el paso 2 solo abre muros, nunca los cierra, por lo que la conexidad se conserva. El mapa siempre es resoluble: cualquier sala de la lista de mástiles se alcanza desde la salida. El paso 4 del plan lo comprueba con un script temporal (BFS desde la sala `(10, 7)`): 0 salas inalcanzables en las rondas 1 a 12. Con el algoritmo descrito se obtuvo, en esas 12 rondas, 339 conexiones, 639 casillas transitables, 0 inalcanzables y una distancia máxima de 25 a 38 pasos de sala (2.000 a 3.040 px, de 10 a 15 s a 200 px/s), y entre 215 y 259 salas candidatas para mástiles.

### Colocación (`maze.ts`)

Con un BFS en salas desde la salida y `mulberry32((18018 + r) × 2 + 1)`:

- **Mástiles:** candidatas = salas con BFS ≥ 10. Se barajan (Fisher–Yates) y se eligen en orden las que estén a Manhattan ≥ 6 de las ya elegidas, hasta 8. Si no salen 8, se baja el mínimo a 5, 4 y 3 y se repite. Existe solución con 6 (las 4 esquinas y las salas `(6, 0)`, `(13, 0)`, `(6, 14)` y `(13, 14)`) y con 3 sobra espacio, así que el algoritmo siempre termina con 8.
- **Vigías:** cantidad `min(7, 2 + r)`. Candidatas = salas con BFS ≥ 12 que no sean mástil. Misma selección con Manhattan ≥ 3 entre ellos. Cada vigía arranca en el centro de su sala, con dirección al azar entre sus salidas abiertas. Entre 179 y 235 candidatas en las 12 primeras rondas.

### Reglas numéricas

- Inicio: ronda 1, puntuación 0, 3 vidas, coche en `(860, 620)` mirando hacia arriba, cámara en `(460, 340)`, 0/8 mástiles, 3 vigías.
- Coche: se mueve mientras hay una flecha o `WASD` pulsada, a 200 px/s, en una sola dirección. Si hay varias teclas, manda la última pulsada y, al soltarla, vuelve a la anterior que siga pulsada. Sin inercia: al soltar se detiene.
- Colisión: el coche es un cuadrado de 24 px (medio lado 12) y los pasillos miden 40 px, así que queda un margen de 8 px a cada lado. El movimiento se resuelve eje a eje; con `dt` ≤ 0,05 s el paso máximo es 10 px, menor que 12, así que no atraviesa un muro de 40 px.
- Ayuda de giro: si el coche avanza por un pasillo y se pide una dirección perpendicular bloqueada, pero la casilla libre contigua queda a ≤ 14 px del centro del coche en el eje de marcha, el coche se desliza hacia el centro de esa casilla a 200 px/s y, ya alineado, gira. Sin esa ayuda, entrar en un pasillo lateral exigiría acertar con ±8 px.
- Mástil: se ocupa si la distancia del centro del coche al del mástil es ≤ 16 px. Mientras se ocupa, el progreso sube `dt / 1,0`; si el coche sale del radio el progreso vuelve a 0 al instante. Al llegar a 1 el mástil queda izado (no vuelve a bajar) y suma 200. A 200 px/s el coche cruza los 32 px del diámetro en 0,16 s, así que pasar de largo nunca iza: hay que quedarse. Solo se ocupa un mástil a la vez (están a ≥ 6 salas, 480 px o más).
- Ritmo: si el mástil se iza a ≤ 20 s del anterior (o del inicio de la ronda, para el primero), suma +100. El reloj del ritmo cuenta solo en `playing` y `dead`.
- Vigía, patrulla: avanza por el centro del pasillo a `min(150, 100 + 10 × (r - 1))` px/s (ronda 1: 100; ronda 6 en adelante: 150). Al llegar al centro de una sala elige al azar (con su PRNG) una salida abierta que no sea la de vuelta; si solo hay una, da la vuelta.
- Vigía, visión: ve el coche si está en su mismo pasillo recto (desalineación lateral ≤ 12 px), a ≤ 320 px y sin casillas de muro entre ambos. Entonces persigue en línea recta hacia el coche a `patrulla + 40` px/s (190 como máximo, menor que los 200 del coche). No calcula caminos: si el coche gira a un pasillo lateral, la desalineación supera 12 px y pierde la visión.
- Vigía, confuso: al perder la visión se queda quieto 1,5 s y vuelve a patrullar desde donde esté (continúa por la salida más cercana a su dirección).
- Contacto: si las cajas de 24 px del coche y de un vigía se solapan y la invulnerabilidad del coche es 0, el coche pierde una vida (fase `dead`). Con invulnerabilidad activa, los vigías atraviesan al coche sin dañarlo.
- Muerte: el mundo se congela 1,2 s con una explosión de 8 partículas (0,5 s). Si quedan vidas, el coche reaparece en `(860, 620)` mirando hacia arriba, parpadeando con 2 s de invulnerabilidad; los vigías vuelven a sus salas de origen en patrulla; los mástiles izados se conservan y el progreso del mástil en curso vuelve a 0. Si no quedan vidas, termina la partida.
- Vida extra: cada vez que la puntuación cruza un múltiplo de 5.000 (hasta 5 vidas); no se acumulan pendientes si ya hay 5.
- Ronda superada: al izar el octavo mástil se suma `200 (+100 de ritmo)` y la fase pasa a `clear` 2,0 s con el texto `Ronda superada +N`, donde `N = 500 + 10 × floor(par restante)`. El par de la ronda es `max(90, 150 − 10 × (r − 1))` s (150 en la ronda 1, 90 desde la 7) y cuenta atrás en `playing` y `dead`; al llegar a 0 se queda en 0 (no mata). Después se genera la ronda siguiente: laberinto nuevo, coche en la salida sin invulnerabilidad, mástiles y vigías nuevos.
- Máximo teórico de la ronda 1: `8 × 300 + 500 + 10 × 150 = 4.400` puntos; el tope duro del motor es 9.999.999 (`CHECK` de `scores`): `score = min(score, 9999999)`.
- `dt` en segundos con tope de 0,05 s.

Fases: `ready` → `playing` ⇄ `dead` (1,2 s) → `playing` o `gameover`; `playing` → `clear` (2,0 s) → `playing` (ronda siguiente). `P` solo actúa en `playing`, `dead` y `clear` (en `ready` y `gameover` se ignora).

Mapeo a `GameStats`:

- `score`: la puntuación descrita arriba.
- `lives`: vidas reales, de 3 a 0 (máximo 5). `0` en `gameover`.
- `level`: la ronda, sin tope visible.

Teclas:

- `←` `↑` `→` `↓` y `A` `W` `D` `S`: conducir.
- `Espacio`: en `ready` arranca; en `gameover` reinicia (ronda 1, mismo laberinto inicial) y emite `onRestart`, ignorando `e.repeat`. En `playing` no hace nada (sin disparo ni freno).
- `P`: pausa y reanuda. Emite `onPauseChange`.
- `K` queda libre para el selector de skins que añadirá `skin-designer` (`S` es "abajo" en WASD).
- Al perder el foco de la ventana (`blur`) se sueltan todas las teclas retenidas, para que el coche no siga solo.

Registro:

```ts
// app/lib/games/registry.ts
ENGINES.banderas = {
  factory: createBanderasGame,
  width: 800,
  height: 600,
  controls: "← ↑ → ↓ / WASD CONDUCIR · ESPACIO EMPEZAR/REINICIAR · P PAUSA",
  initialLives: 3,
  // Mínimo para que compile `GameDefinition` (SPEC 10); `mobile-porter` lo revisa.
  touch: {
    dpad: { up: true, down: true, left: true, right: true },
    a: { code: "Space", label: "EMPEZAR", short: "A" },
    skin: "KeyK",
  },
};
```

Assets: ninguno. Formas del canvas:

- Fondo `#05070d`. Suelo de las casillas transitables `#0b1f14`; muros `#0f3a22` con borde de 2 px verde `#39ff88`.
- Coche: rectángulo redondeado de 24×24 blanco con borde verde y dos faros delanteros de 4 px según el rumbo.
- Vigías: rombo rojo `#ff3860` de 24 px con un ojo; en persecución parpadea y en `confuso` muestra `?`.
- Mástil: poste de 20 px con bandera amarilla; el anillo de progreso se dibuja alrededor del mástil mientras se ocupa; izado = bandera completa verde.
- HUD del canvas (franja de 40 px): `PUNTOS 000000`, `RONDA 01`, `MÁSTILES 0/8`, iconos de vida, `PAR 150` y brújula (triángulo orientado al mástil no izado más cercano en distancia euclídea y la distancia en casillas, `D 14`).

Fila nueva en `games`:

```sql
insert into public.games (id, title, short, long, cat, cover, color, sort_order)
values (
  'banderas',
  'BANDERAS',
  'Conduce por un laberinto enorme, iza los ocho mástiles de cada ronda y esquiva a los vigías.',
  'Recorre un laberinto de 41×31 casillas que la cámara sigue con tu coche. Mantén el coche un segundo sobre cada mástil para izar su bandera, esquiva a los vigías que patrullan y te persiguen en línea recta si te ven, y completa los ocho mástiles de la ronda antes de que se acabe el tiempo de bonificación. Tienes 3 vidas y ganas una cada 5.000 puntos.',
  'LABERINTO',
  'cover-banderas',
  'green',
  (select coalesce(max(sort_order), 0) + 1 from public.games)
);
```

Datos reales de la BD el 2026-11-23 (consulta `select id, cat, color, sort_order from public.games order by sort_order`): 6 filas (`asteroids` 1, `tetris` 2, `arkanoid` 3, `snake` 4, `frogger` 5, `horizonte` 6). El máximo es 6, así que `banderas` queda en `sort_order` 7 y el catálogo pasa a 7 tarjetas. El `sort_order` se calcula en el propio `insert` (`max + 1`) porque la migración de `horizonte` del repo escribe 14 y la BD tiene 6: se deja el cálculo para no chocar con `games_sort_order_key` (único) en ningún entorno.

Migración de categoría (archivo propio, antes de la fila del juego). Hoy `games_cat_check` es `CHECK (cat = ANY (ARRAY['ARCADE','PUZZLE','SHOOTER','VERSUS']))`:

```sql
alter table public.games drop constraint games_cat_check;
alter table public.games
  add constraint games_cat_check
  check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS', 'LABERINTO'));
```

Cambios de código asociados: `GameCategory` en `app/data/games.ts` pasa a `"ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS" | "LABERINTO"` y `CATS` en `app/data/categories.ts` añade `"LABERINTO"` (el filtro de `/games` lo muestra solo). No hace falta regenerar `database.types.ts`: `cat` es `string` en el esquema generado y el `CHECK` no se refleja en los tipos.

---

## Plan de implementación

1. **Leer la documentación.** La guía de `node_modules/next/dist/docs/01-app` relevante para componentes cliente y `cacheComponents`, `app/lib/games/types.ts`, `app/lib/games/registry.ts` y `app/games/snake/engine.ts` como motor de ejemplo sin original. No genera código.
2. **Categoría `LABERINTO`.** Migración `supabase/migrations/YYYYMMDDHHMMSS_add_laberinto_category.sql` con el `drop`/`add constraint` de arriba, aplicada con `mcp__supabase__apply_migration`; ampliar `GameCategory` y `CATS`. Manual: `npx tsc --noEmit` sin errores, `/games` arranca, el filtro muestra la pestaña `LABERINTO` sin tarjetas, y `select pg_get_constraintdef(oid) from pg_constraint where conname = 'games_cat_check'` incluye `LABERINTO`.
3. **Constantes y PRNG.** `constants.ts` con los valores de este spec y `rng.ts` con `mulberry32(seed)` y `shuffle`. Manual: `npx tsc --noEmit` y la app sigue arrancando.
4. **Laberinto y colocación.** `maze.ts` con funciones puras: `generateMaze(round)` (árbol, bucles), `bfsRooms`, `pickMasts`, `pickGuards`, `isWallAt(px, py)`. Manual: un script temporal con `tsx` (fuera de `app/`, se borra después) que para las rondas 1 a 12 imprime conexiones (339), casillas transitables (639), salas inalcanzables (0), mástiles elegidos (8) y vigías (`min(7, 2 + r)`).
5. **Coche y cámara.** Movimiento en 4 direcciones con última tecla manda, colisión eje a eje, ayuda de giro y `camera(carX, carY)`. Manual: `npx tsc --noEmit`.
6. **Vigías.** Patrulla, visión, persecución, confuso y contacto, con su PRNG. Manual: `npx tsc --noEmit`.
7. **Núcleo del motor.** `engine.ts`: estado en el cierre de `createBanderasGame`, `reset()`, fases, mástiles e izado, ritmo, puntuación, vidas, vida extra, muerte, reaparición, rondas y par. Sin teclado aún.
8. **Bucle y entrada.** `requestAnimationFrame` con `dt` limitado a 0,05 s; `keydown`/`keyup` en `window` ignorando `input`, `textarea` y `button`; `preventDefault` solo en flechas, `WASD`, `Espacio` y `P`; pila de teclas retenidas y `blur` que las suelta. Manual: en `/games/banderas/play` el coche se mueve y la cámara lo sigue.
9. **Dibujo.** Casillas visibles, coche, vigías, mástiles con anillo, explosión, HUD con brújula y pantallas `Pulsa ESPACIO para arrancar`, `PAUSA`, `Ronda superada` y `Game over`.
10. **Ciclo de vida.** `start`, `pause`, `resume` (reinicia `lastTime`), `restart`, `end` y `destroy`; tecla `P` con `onPauseChange`; `onStats` solo cuando cambia `score`, `lives` o `level` (y al iniciar o reiniciar); un único `finish()` con indicador `gameOver` que llama a `onGameOver` una vez; `onRestart` al reiniciar con `Espacio` ignorando `e.repeat`.
11. **Registro y catálogo.** Entrada `banderas` en `ENGINES` (con el `touch` mínimo); migración nueva `supabase/migrations/YYYYMMDDHHMMSS_add_banderas_game.sql` aplicada con `mcp__supabase__apply_migration`; portada `.cover-banderas` en `app/globals.css` con `/frontend-design`, verde, distinta de `.cover-frogger` (también verde).
12. **Repaso.** `npm run lint`, `npx tsc --noEmit`, `npm run build`, partida completa guardada y comprobada en `/games/banderas`, `/hall-of-fame` y `/`, consola, `get_advisors`, borrado de filas de prueba y retirada de código muerto (incluido el script temporal).

---

## Criterios de aceptación

**Calidad**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] La consola no muestra errores ni avisos de React en `/games/banderas/play`.
- [ ] A 375 px de ancho no hay scroll horizontal y el canvas no se deforma.
- [ ] Asteroides, Tetris, Arkanoid, Snake, Frogger y Horizonte conservan su canvas, su línea de controles y sus vidas iniciales (3, 1, 3, 1, 3 y 3).
- [ ] El teclado se escucha en `window` e ignora `input`, `textarea` y `button`; `preventDefault` solo afecta a las teclas del juego.

**Catálogo**

- [ ] `/games` muestra 7 tarjetas y la de BANDERAS tiene portada propia `.cover-banderas`, verde y distinguible de `.cover-frogger`.
- [ ] El filtro de `/games` incluye la pestaña `LABERINTO` y al elegirla solo aparece BANDERAS; las demás pestañas no cambian.
- [ ] `/games/banderas` y `/games/banderas/play` responden 200.
- [ ] `games` contiene la fila `banderas` (`LABERINTO`, `green`, `sort_order` 7), `games_cat_check` admite `LABERINTO` y `list_migrations` lista las dos migraciones.
- [ ] Las filas existentes de `games` no cambian.

**Juego**

- [ ] Al cargar aparece el canvas (no `.game-arena`) con el coche dibujado en `(400, 320)` de pantalla (mundo `(860, 620)`, cámara `(460, 340)`), la franja de HUD de 40 px, `MÁSTILES 0/8` y el texto `Pulsa ESPACIO para arrancar`. Nada se mueve hasta pulsar `Espacio`.
- [ ] Ambos HUD (canvas y HTML) muestran puntuación 0, tres `♥` y nivel 01 al empezar.
- [ ] El laberinto tiene 639 casillas transitables y 632 muros, y es el mismo en dos partidas seguidas (misma semilla 18019 en la ronda 1).
- [ ] Mantener `→` en un pasillo recto recorre 200 px en 1,0 s (±0,05 s). Las flechas y `WASD` conducen; al soltar, el coche se detiene en seco.
- [ ] Con dos teclas pulsadas manda la última; al soltarla, vuelve a la anterior si sigue pulsada.
- [ ] El coche no atraviesa muros ni al ir a velocidad máxima con un `dt` de 0,05 s, y nunca sale del mapa.
- [ ] Pedir un giro con el coche a ≤ 14 px del centro del pasillo lateral lo mete en él sin quedarse atascado; a más de 14 px, no.
- [ ] La cámara se queda parada en `x = 0` o `y = 0` cerca de las esquinas y nunca muestra fuera del mapa (`camX` entre 0 y 840, `camY` entre 0 y 680).
- [ ] Pasar sobre un mástil a 200 px/s sin parar no lo iza. Mantenerse ≤ 16 px de su centro durante 1,0 s lo iza, suma exactamente 200 (o 300 con ritmo) en ambos HUD y `MÁSTILES` sube en 1. Salirse antes de 1,0 s pone el anillo a 0.
- [ ] El primer mástil izado a ≤ 20 s del inicio de la ronda suma 300; a más de 20 s, 200. Lo mismo entre mástiles consecutivos.
- [ ] Hay 8 mástiles, todos a ≥ 10 pasos de sala de la salida y a Manhattan ≥ 6 entre sí, y todos son alcanzables.
- [ ] La ronda 1 tiene 3 vigías, la 2 tiene 4 y a partir de la 5 tiene 7 como máximo. Ninguno arranca a menos de 12 pasos de sala de la salida.
- [ ] Un vigía patrulla a 100 px/s en la ronda 1 y no gira 180° salvo en un callejón sin salida.
- [ ] Un vigía que ve el coche (mismo pasillo, ≤ 320 px, sin muro entre ambos) acelera a 140 px/s y va hacia él en línea recta; si el coche gira a un pasillo lateral pierde la visión, se queda 1,5 s con `?` y vuelve a patrullar. Nunca alcanza al coche en una recta larga (140 < 200 px/s).
- [ ] Tocar un vigía quita una vida en ambos HUD; el mundo se congela 1,2 s; el coche reaparece en `(860, 620)` parpadeando 2 s sin que los vigías le dañen; los vigías vuelven a sus salas de origen y los mástiles izados se conservan.
- [ ] Morir ocupando un mástil deja su progreso en 0 al reaparecer.
- [ ] Izar el octavo mástil muestra `Ronda superada +N` con `N = 500 + 10 × floor(par restante)`, el nivel pasa a 02 en ambos HUD, el laberinto cambia (semilla 18020), el coche vuelve a la salida y hay 4 vigías.
- [ ] El par de la ronda 1 empieza en 150 y baja 1 por segundo; en la ronda 2 empieza en 140; al llegar a 0 se queda en 0 sin matar al coche.
- [ ] Al cruzar 5.000 puntos se gana una vida (cuatro `♥`); nunca hay más de cinco.
- [ ] La brújula apunta al mástil no izado más cercano y su distancia (en casillas) baja al acercarse.
- [ ] Perder la última vida termina la partida: el canvas muestra `Game over` con la puntuación y el HUD pasa a 0 `♥`.
- [ ] Ambos HUD muestran siempre los mismos `score`, `lives` y `level`.
- [ ] PAUSA congela el coche, los vigías, el progreso de izado y el par; el canvas muestra `PAUSA` y el botón pasa a REANUDAR. La tecla `P` hace lo mismo y emite el cambio de estado a React. Al reanudar no hay salto de movimiento.
- [ ] Cambiar de pestaña con una flecha pulsada (`blur`) detiene el coche; no sigue avanzando al volver.
- [ ] Al terminar, el canvas muestra `Game over` y el modal aparece con la misma puntuación, una sola vez.
- [ ] `Espacio` en `Game over` reinicia con 0 puntos, tres `♥`, nivel 01 y la misma ronda 1, y cierra el modal. Si la tecla seguía pulsada (`e.repeat`), no reinicia hasta soltarla y volver a pulsar.
- [ ] FIN abre el modal con la puntuación actual y JUGAR DE NUEVO reinicia.
- [ ] Se puede escribir un nombre con espacios en el modal sin que `Espacio` arranque o reinicie el juego ni `P` lo pause.
- [ ] Salir y volver, y el doble montaje de StrictMode, no dejan dos bucles ni listeners duplicados: el coche recorre 200 px/s, no 400, y cada pulsación de `P` pausa una sola vez.
- [ ] La línea de controles aparece en `/games/banderas/play` con las teclas de Banderas y no en juegos sin motor.

**Leaderboard**

- [ ] GUARDAR PUNTUACIÓN inserta en `scores` una fila con `game_id = 'banderas'`, el nombre y la puntuación del modal. Un doble clic crea una sola fila.
- [ ] Tras guardar, `/games/banderas` la muestra en `#01`, `Partidas` y `Mejor global` se actualizan, y aparece en `/hall-of-fame` y en la actividad de `/`.
- [ ] Los juegos sin motor siguen con simulación y sin botón de guardar.
- [ ] Tras las pruebas, `scores` no contiene filas de prueba.
- [ ] Una búsqueda de `service_role` en `app/` no da resultados.

---

## Decisiones

- **Sí:** id nuevo `banderas`, el mismo de la propuesta GP-018 (es el juego de esa entrada del TODO, no un choque). **No:** reutilizar un id existente. **Supuesto del agente.**
- **Sí:** categoría nueva `LABERINTO` con migración del `CHECK` y cambio de `GameCategory` y `CATS`, porque el TODO dice "Requiere LABERINTO". **No:** meterlo en `ARCADE`. Es el único cambio de esquema. **Supuesto del agente.**
- **Sí:** color `green`, como pide GP-018, aunque `frogger` también lo es; la portada debe distinguirse. **No:** color nuevo (los `CHECK` solo admiten 4).
- **Sí:** izar manteniéndose 1,0 s sobre el mástil, vigías con visión recta y brújula en lugar de radar. **No:** minimapa de radar, combustible, humo, rocas, banderas recogidas al paso ni coches perseguidores con IA de camino: es la combinación firma de un clásico concreto y no se recrea. **Supuesto del agente.**
- **Sí:** laberinto generado por semilla (`18018 + ronda`) con árbol y 40 bucles, el mismo en cada partida para que el ranking sea comparable. **No:** semilla aleatoria por partida ni mapas dibujados a mano. Los bucles dan rutas de escape; sin ellos el laberinto sería un árbol y cualquier persecución, una trampa. **Supuesto del agente.**
- **Sí:** casillas de 40 px con pasillos de 1 casilla, coche de 24 px y ayuda de giro de 14 px, porque exigir ±8 px de precisión en cada esquina frustra. **No:** movimiento libre en el plano ni giros solo por rejilla.
- **Sí:** el coche solo se mueve mientras se pulsa una tecla y se detiene al soltar. **No:** avance automático continuo, para que parar sobre un mástil sea una decisión y no un fallo de control.
- **Sí:** vigías más lentos que el coche (190 como máximo frente a 200), para que ningún vigía sea inevitable en una recta. **No:** vigías más rápidos.
- **Sí:** 3 vidas, vida extra cada 5.000 (máximo 5), reaparición en la salida con 2 s de invulnerabilidad y mástiles izados conservados. **No:** perder el progreso de la ronda al morir. **Supuesto del agente.**
- **Sí:** par de tiempo solo como bonificación, sin límite duro. **No:** que el par mate (eso es la variante B).
- **Sí:** `lives` reales y `level` = ronda, con `initialLives: 3`. Es el caso "con vidas propias" del contrato.
- **Sí:** `Espacio` reinicia ignorando `e.repeat`, teclado en `window` ignorando `input`, `textarea` y `button`, `P` para pausar y soltar teclas en `blur`.
- **Sí:** `K` reservada para skins y `touch` mínimo en el registro. **No:** diseñar aquí skins ni el mando táctil, que hacen `skin-designer` y `mobile-porter`.
- **Sí:** `sort_order` calculado con `max + 1` en el `insert`. **No:** fijar 7 a mano, por la discrepancia entre la migración de `horizonte` (14) y la BD (6).
- **Sí:** formas del canvas y sin sonido. **No:** inventar assets.

## Riesgos

| Riesgo                                                            | Mitigación                                                                                                                                               |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| StrictMode duplica motores                                        | `destroy()` cancela `requestAnimationFrame` y quita todos los listeners (incluido `blur`); criterio de aceptación                                        |
| El laberinto generado no es conexo o un mástil queda aislado      | Árbol de expansión más bucles (solo abre muros); script temporal del paso 4 que comprueba 12 rondas (0 inalcanzables, 339 conexiones)                    |
| La colocación no encuentra 8 mástiles separados                   | Se baja `minPair` de 6 a 3; existe solución con 6 y hay 215 a 259 candidatas por ronda                                                                   |
| El coche atraviesa un muro con un `dt` grande                     | `dt` ≤ 0,05 s (paso máx. 10 px < 12 px de medio lado) y resolución eje a eje                                                                             |
| Se atasca en las esquinas por los 8 px de margen                  | Ayuda de giro de 14 px; criterio de aceptación                                                                                                           |
| Vigía imposible de esquivar                                       | Más lento que el coche (≤ 190 < 200), pierde la visión al girar, 2 s de invulnerabilidad al reaparecer y salida lejos de los vigías (≥ 12 pasos de sala) |
| Parecido con un clásico concreto del género                       | Lista de elementos excluidos en "Por qué existe este spec" y Decisiones; izado, vigías y brújula propios                                                 |
| `Espacio` pulsado en el modal arranca o reinicia                  | El teclado ignora objetivos `input`, `textarea` y `button`; criterio de aceptación                                                                       |
| `Espacio` mantenido al perder reinicia al instante                | Se ignora `e.repeat`; criterio de aceptación                                                                                                             |
| Tras pausar, el `dt` acumulado provoca un salto                   | `lastTime` se reinicia en `resume()` y `dt` tiene tope de 0,05 s                                                                                         |
| Teclas atascadas tras cambiar de pestaña                          | `blur` suelta todas las teclas retenidas                                                                                                                 |
| La nueva categoría rompe el filtro o el `CHECK` en otros entornos | Migración propia antes de la del juego, `GameCategory` y `CATS` en el mismo paso; criterios de Catálogo                                                  |
| `sort_order` distinto en otro entorno                             | `max + 1` en el `insert`; el paso 11 lo comprueba con `execute_sql`                                                                                      |
| Dos tarjetas verdes (`frogger`) se confunden en `/games`          | `.cover-banderas` con composición propia (laberinto y mástil), criterio de aceptación                                                                    |
| El coste de dibujar el mapa                                       | Solo se dibujan las 315 casillas visibles como máximo                                                                                                    |

---

## Qué **no** está en este spec

- Sonido.
- Minimapa de radar, combustible, humo, rocas y power-ups.
- Skins y ajuste del mando táctil (agentes `skin-designer` y `mobile-porter`).
- Mapas a mano, editor de laberintos y semilla elegida por el jugador.
- Récords locales y dos jugadores.
- Escalado por `devicePixelRatio`.
- Anti-trampas y tests automatizados.
- La variante B (contrarreloj con niebla y rivales que compiten por las banderas), que queda como alternativa no elegida en `specs/game-jam/banderas/`.

Cada uno de esos puntos, si se aborda, va en su propia spec.
