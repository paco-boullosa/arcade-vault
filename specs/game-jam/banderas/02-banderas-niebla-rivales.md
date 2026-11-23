# GAME JAM — BANDERAS · Variante B: Niebla y rivales

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-23
> **Objective:** Crear `banderas`, un juego de coche por un laberinto de 41×31 casillas con cámara que sigue al coche, en niebla, donde hay que capturar 6 banderas por ronda antes que los coches rivales, ganando tiempo con cada una (contrarreloj de 90 s, sin vidas) y usando un sonar que revela el mapa un instante, como motor TypeScript con canvas único 800×600 y ranking en Supabase.

---

## Por qué existe este spec

Es el resultado de la game jam con el tema GP-018 del TODO del `game-planner` (`banderas`, LABERINTO, 22/25): "coche en laberinto grande con cámara, radar y rivales. Requiere LABERINTO. Verde. Complejidad técnica media (T=3)". Sería el primer juego de la categoría LABERINTO y el séptimo con motor real (Asteroides, Tetris, Arkanoid, Snake, Frogger y Horizonte ya existen), y reutiliza el leaderboard genérico de SPEC 06 y la `GameDefinition` de SPEC 07 (con el campo `touch` de SPEC 10). No hay código de referencia: las reglas se definen aquí, como en SPEC 09.

La nota del TODO describe, casi tal cual, la combinación de un clásico concreto del género (coche que recoge banderas en un laberinto con scroll, minimapa de radar, combustible, humo y coches que le persiguen). Este spec **no** la recrea. Se descartan expresamente: el minimapa de radar continuo, el depósito de combustible, la pantalla de humo, las rocas y los coches que persiguen al jugador. En su lugar el diseño propio es:

- Los rivales **no te persiguen: compiten**. Cada uno va a por la bandera más cercana y, si la captura, desaparece para ti. No te matan; un choque cuesta tiempo.
- La niebla limita la vista a 200 px; el mapa explorado queda atenuado.
- El **sonar** (`Espacio`, cada 8 s) revela 1,5 s todas las banderas y rivales, con marcadores en el borde del visor si están fuera de pantalla. Es el sustituto acotado del radar: un pulso, no un minimapa continuo.
- El tiempo es el recurso (90 s, +8 s por bandera), no el combustible, y el multiplicador de racha premia capturas seguidas.
- El laberinto se genera por semilla, con bucles, y cada ronda es uno nuevo; ningún mapa procede de otro juego.

El título, el id (`banderas`, el de la propuesta GP-018), los rivales, el sonar y el aspecto neón con formas del canvas son propios. Esta variante es la de puntuación y tiempo: sin vidas, fin al llegar el reloj a 0. La variante A comparte id, título, categoría, color, laberinto, coche y fila de `games`, pero cambia la mecánica (izar mástiles 1 s, vigías que patrullan y persiguen en recta, 3 vidas, sin niebla ni sonar).

No hay assets en `references/source-assets/` para este juego (solo existe `snake-assets/`), así que todo se dibuja con formas del canvas y no hay sonido.

---

## Alcance

**Dentro:**

- Motor en `app/games/banderas/` (TypeScript puro, sin React, sin estado global).
- Laberinto de 41×31 casillas de 40 px (1640×1240 px) generado por semilla (recorrido en profundidad más 40 bucles), nuevo en cada ronda, con cámara que sigue al coche en un visor de 800×560 px.
- Coche con movimiento en 4 direcciones (una a la vez), colisión por píxeles contra los muros y ayuda de giro.
- 6 banderas por ronda que se capturan al tocarlas.
- Rivales (2 en la ronda 1, hasta 4) que van por BFS a la bandera más cercana y la capturan si llegan antes.
- Niebla de visión de 200 px con memoria del mapa explorado.
- Sonar con recarga de 8 s.
- Reloj de 90 s (+8 s por bandera propia, +10 s por ronda, máximo 120 s), fin al llegar a 0. Sin vidas.
- Racha de capturas con multiplicador x1–x4.
- Pantallas del canvas: inicio (`Pulsa ESPACIO para arrancar`), `PAUSA`, `Ronda superada` y `Game over`.
- Entrada en `ENGINES` con la clave `banderas`.
- **Categoría nueva `LABERINTO`**: migración que amplía `games_cat_check`, cambio de `GameCategory` en `app/data/games.ts` y de `CATS` en `app/data/categories.ts`.
- Fila `banderas` en `games` mediante una migración nueva y portada CSS `.cover-banderas`, hecha con `/frontend-design`.
- Guardado en `scores` con `game_id = 'banderas'`.

**Fuera de alcance (para otros specs):**

- Sonido (no hay assets y no se inventa).
- Minimapa de radar continuo, combustible, humo, rocas y power-ups.
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

Constantes (`app/games/banderas/constants.ts`), definidas aquí porque no hay original. Las del laberinto, la cámara y el coche son las mismas que en la variante A:

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
};

export const FLAG = {
  perRound: 6,
  captureRadius: 20, // px entre centros
  minBfs: 8, // pasos de sala mínimos desde la salida
  minPair: 6, // distancia Manhattan mínima entre banderas (en salas)
  minPairFloor: 3,
};

export const RIVAL = {
  size: 24,
  base: 1, // rivales = min(max, base + ronda)
  max: 4,
  speed: 140, // ronda 1
  speedDelta: 10,
  speedMax: 190, // menor que los 200 del coche
  minBfs: 12, // pasos de sala mínimos desde la salida
  minPair: 3,
  crashSec: 3, // tiempo que cuesta un choque
  crashImmuneSec: 1.5,
};

export const FOG = {
  fullPx: 160, // visibilidad total
  maxPx: 200, // radio máximo de visión y de exploración
  alphaMid: 0.6, // entre 160 y 200 px
  alphaExplored: 0.25, // casillas ya vistas fuera del radio
};

export const SONAR = {
  durationSec: 1.5,
  cooldownSec: 8, // desde el momento de usarlo
  markerInset: 12, // px del borde del visor para los marcadores
};

export const SCORE = {
  flag: 150, // × multiplicador
  streakWindowSec: 15,
  streakMax: 4,
  roundBase: 300,
  roundPerFlag: 100, // por cada bandera propia de la ronda
  max: 9999999,
};

export const CFG = {
  timeStart: 90, // s
  timeFlag: 8, // s por bandera propia
  timeRound: 10, // s al superar la ronda
  timeMax: 120,
  clearMs: 1500,
  dtMax: 0.05, // s
};
```

Convenciones:

- Coordenadas de casilla: origen arriba a la izquierda, `x` de 0 a 40 y `y` de 0 a 30. Coordenadas de sala: `i` de 0 a 19 y `j` de 0 a 14; la sala `(i, j)` es la casilla `(2i + 1, 2j + 1)`. Los muros ocupan las casillas pares o el borde.
- Coordenadas de mundo en px: la casilla `(x, y)` ocupa `[40x, 40x + 40) × [40y, 40y + 40)`. El centro de la sala `(i, j)` es `(80i + 60, 80j + 60)`.
- Cámara: `camX = clamp(carX - 400, 0, 840)`, `camY = clamp(carY - 280, 0, 680)`. El mundo se dibuja desplazado `(-camX, HUD_H - camY)` con recorte al visor `(0, 40, 800, 560)`. Sin suavizado.
- Casillas dibujadas por frame: `(20 + 1) × (14 + 1) = 315` como máximo, solo las exploradas.
- Ronda `r` (empieza en 1): semilla del laberinto `18018 + r`; semilla de colocación `(18018 + r) × 2 + 1`.

### Generación del laberinto (`maze.ts`, funciones puras)

Idéntica a la variante A. PRNG `mulberry32(seed)`. Toda la casilla empieza como muro.

1. **Árbol.** Recorrido en profundidad iterativo desde la sala `(0, 0)`. En cada paso se listan los vecinos no visitados en el orden N, E, S, O; si hay alguno se elige el índice `floor(rng() × n)`, se abre la casilla de la sala vecina y la casilla de conexión, y se apila; si no hay, se desapila. Abre `300 − 1 = 299` conexiones.
2. **Bucles.** Se listan las conexiones aún cerradas (primero la del este y luego la del sur de cada sala, en orden `j`, `i`), se barajan con Fisher–Yates (`j = floor(rng() × (k + 1))`, de atrás adelante) y se abren las 40 primeras.
3. Resultado: `299 + 40 = 339` conexiones, `300 + 339 = 639` casillas transitables y `1271 − 639 = 632` muros. Las casillas de borde son siempre muro.

Conexidad: el paso 1 es un árbol que visita las 300 salas; el paso 2 solo abre muros. Todas las salas son alcanzables desde la salida, y por tanto toda bandera lo es. El paso 4 del plan lo comprueba con un script temporal (BFS desde la sala `(10, 7)`): 0 inalcanzables en las rondas 1 a 12. Con este algoritmo se obtuvo en esas rondas 339 conexiones, 639 casillas transitables, distancia máxima de 25 a 38 pasos de sala (2.000 a 3.040 px, de 10 a 15 s a 200 px/s) y entre 241 y 274 salas candidatas para banderas.

### Colocación (`maze.ts`)

Con un BFS en salas desde la salida y `mulberry32((18018 + r) × 2 + 1)`:

- **Banderas:** candidatas = salas con BFS ≥ 8. Se barajan y se eligen en orden las que estén a Manhattan ≥ 6 de las ya elegidas, hasta 6. Si no salen 6, se baja el mínimo a 5, 4 y 3 y se repite. Existe solución con 6 (las 4 esquinas y las salas `(6, 0)` y `(13, 14)`), así que el algoritmo siempre termina con 6.
- **Rivales:** cantidad `min(4, 1 + r)`: 2 en la ronda 1, 3 en la 2 y 4 desde la 3. Candidatas = salas con BFS ≥ 12 que no sean bandera. Misma selección con Manhattan ≥ 3 entre ellos (más de 179 candidatas en las 12 primeras rondas).

### Reglas numéricas

- Inicio: ronda 1, puntuación 0, reloj 90, coche en `(860, 620)` mirando hacia arriba, cámara en `(460, 340)`, 0 banderas propias, racha x1, sonar disponible, 2 rivales.
- Coche: se mueve mientras hay una flecha o `WASD` pulsada, a 200 px/s, en una sola dirección; manda la última pulsada y, al soltarla, vuelve a la anterior que siga pulsada. Sin inercia. Colisión por cuadrado de 24 px contra muros de 40 px (margen de 8 px por lado), resuelta eje a eje; con `dt` ≤ 0,05 s el paso máximo es 10 px, menor que el medio lado (12). Ayuda de giro: si se pide una dirección perpendicular bloqueada y la casilla libre contigua queda a ≤ 14 px del centro del coche en el eje de marcha, el coche se desliza hacia su centro a 200 px/s y gira.
- Reloj: baja 1 por segundo en `playing`; no corre en `ready`, en `clear`, en pausa ni en `gameover`. Al llegar a 0 termina la partida.
- Captura propia: si el centro del coche está a ≤ 20 px del centro de una bandera, se captura. Suma `150 × multiplicador`, `+8 s` de reloj (tope 120) y la bandera desaparece.
- Racha: hay un multiplicador `m` que empieza en 1. En cada captura propia: si han pasado más de 15 s desde la captura propia anterior (o desde el inicio de la ronda, para la primera), `m` vuelve a 1; se suman `150 × m` puntos; y después `m = min(4, m + 1)`. Así una racha vale `150`, `300`, `450` y de la cuarta captura en adelante `600`, siempre que cada captura llegue a ≤ 15 s de la anterior. Un choque con un rival pone `m` a 1.
- Captura rival: si el centro de un rival está a ≤ 20 px del de una bandera, la bandera desaparece sin puntos ni tiempo para nadie. Si coche y rival llegan en el mismo frame, gana el coche. La racha no se ve afectada.
- Rival: cuadrado de 24 px que va por el centro de los pasillos a `min(190, 140 + 10 × (r - 1))` px/s (ronda 1: 140; ronda 6 en adelante: 190). Al llegar al centro de una sala calcula con un BFS en salas la bandera restante más cercana (empate: la primera en orden `j`, `i`) y toma la salida que sigue ese camino. No calcula nada sobre el coche ni lo persigue. Si la bandera desaparece, se recalcula en la siguiente sala. Los rivales atraviesan a otros rivales.
- Choque: si las cajas de 24 px del coche y de un rival se solapan y la inmunidad de choque es 0, el reloj baja 3 s (mínimo 0, y a 0 termina la partida), la racha vuelve a x1 y el coche queda 1,5 s inmune a choques (parpadea). Ni el coche ni el rival se empujan.
- Niebla: se ve una casilla si el centro de la casilla está a ≤ 200 px del centro del coche. Se dibuja con opacidad 1 a ≤ 160 px y 0,6 entre 160 y 200 px. Toda casilla que haya entrado una vez en el radio queda explorada y se dibuja con opacidad 0,25 fuera de él. Las no exploradas no se dibujan (negro). La memoria de exploración se reinicia en cada ronda. Banderas y rivales solo se dibujan a ≤ 200 px del coche o con el sonar activo.
- Sonar: `Espacio` en `playing`, si está disponible, lo activa 1,5 s. Durante ese tiempo se dibujan todas las banderas restantes y todos los rivales aunque estén fuera de la niebla; los que queden fuera del visor se señalan con un marcador triangular a 12 px del borde (amarillo para banderas, rojo para rivales) en la dirección de su posición. No explora casillas. Tras usarlo, queda no disponible 8,0 s contados desde la activación (disponible de nuevo 6,5 s después de que termine el efecto). En cada ronda nueva vuelve a estar disponible.
- Ronda superada: cuando no queda ninguna bandera (capturadas por el coche o por rivales), la fase pasa a `clear` 1,5 s con el texto `Ronda superada +N`, donde `N = 300 + 100 × banderas propias de la ronda`. El reloj gana +10 s (tope 120). Después se genera la ronda siguiente: laberinto nuevo, coche en la salida, 6 banderas y rivales nuevos, racha x1 y reloj sin cambios salvo el bonus. Una ronda en la que el coche no captura ninguna bandera da 300.
- Máximo teórico de una ronda: `150 × (1 + 2 + 3 + 4 + 4 + 4) + 300 + 6 × 100 = 2.700 + 900 = 3.600` puntos; el tope duro del motor es 9.999.999 (`CHECK` de `scores`): `score = min(score, 9999999)`.
- `dt` en segundos con tope de 0,05 s.

Fases: `ready` → `playing` ⇄ `clear` (1,5 s) → `playing` (ronda siguiente) → `gameover`. `P` solo actúa en `playing` y `clear`.

Mapeo a `GameStats`:

- `score`: la puntuación descrita arriba.
- `lives`: `1` mientras se juega y `0` en `gameover`. Es el mapeo del contrato para juegos sin vidas.
- `level`: la ronda, sin tope visible.

Teclas:

- `←` `↑` `→` `↓` y `A` `W` `D` `S`: conducir.
- `Espacio`: en `ready` arranca; en `playing` lanza el sonar; en `gameover` reinicia (ronda 1, mismo laberinto inicial) y emite `onRestart`, solo si la tecla se ha soltado después del game over e ignorando `e.repeat`.
- `P`: pausa y reanuda. Emite `onPauseChange`.
- `K` queda libre para el selector de skins que añadirá `skin-designer` (`S` es "abajo" en WASD).
- Al perder el foco de la ventana (`blur`) se sueltan todas las teclas retenidas.

Registro:

```ts
// app/lib/games/registry.ts
ENGINES.banderas = {
  factory: createBanderasGame,
  width: 800,
  height: 600,
  controls: "← ↑ → ↓ / WASD CONDUCIR · ESPACIO SONAR/REINICIAR · P PAUSA",
  initialLives: 1,
  // Mínimo para que compile `GameDefinition` (SPEC 10); `mobile-porter` lo revisa.
  touch: {
    dpad: { up: true, down: true, left: true, right: true },
    a: { code: "Space", label: "SONAR", short: "SON" },
    skin: "KeyK",
  },
};
```

Assets: ninguno. Formas del canvas:

- Fondo negro `#05070d`. Suelo `#0b1f14` y muros `#0f3a22` con borde de 2 px verde `#39ff88`, con la opacidad de la niebla.
- Coche: rectángulo redondeado de 24×24 blanco con borde verde y dos faros delanteros; parpadea con la inmunidad de choque.
- Rivales: rectángulo redondeado rojo `#ff3860` de 24 px con faros.
- Bandera: poste de 20 px con bandera amarilla `#ffd400`.
- Sonar: anillo cian que se expande desde el coche durante 1,5 s (solo decorativo).
- HUD del canvas (franja de 40 px): `PUNTOS 000000`, `RONDA 01`, `TIEMPO 90` (rojo y parpadeando por debajo de 10), `BANDERAS 6` (las restantes), `RACHA x1` y una barra de sonar (llena cuando está disponible).

Fila nueva en `games`:

```sql
insert into public.games (id, title, short, long, cat, cover, color, sort_order)
values (
  'banderas',
  'BANDERAS',
  'Conduce a ciegas por un laberinto enorme y captura las banderas antes que los rivales.',
  'Recorre un laberinto de 41×31 casillas en la niebla con una cámara que sigue a tu coche. Captura las seis banderas de cada ronda antes de que lo hagan los coches rivales: cada una te da puntos, más con la racha, y 8 segundos extra. Usa el sonar para ver el mapa un instante y evita los choques, que cuestan 3 segundos. La partida acaba cuando se agota el reloj de 90 segundos.',
  'LABERINTO',
  'cover-banderas',
  'green',
  (select coalesce(max(sort_order), 0) + 1 from public.games)
);
```

Datos reales de la BD el 2026-11-23 (consulta `select id, cat, color, sort_order from public.games order by sort_order`): 6 filas (`asteroids` 1, `tetris` 2, `arkanoid` 3, `snake` 4, `frogger` 5, `horizonte` 6). El máximo es 6, así que `banderas` queda en `sort_order` 7 y el catálogo pasa a 7 tarjetas. El `sort_order` se calcula en el propio `insert` (`max + 1`) porque la migración de `horizonte` del repo escribe 14 y la BD tiene 6: así no se choca con `games_sort_order_key` (único) en ningún entorno.

Migración de categoría (archivo propio, antes de la fila del juego). Hoy `games_cat_check` es `CHECK (cat = ANY (ARRAY['ARCADE','PUZZLE','SHOOTER','VERSUS']))`:

```sql
alter table public.games drop constraint games_cat_check;
alter table public.games
  add constraint games_cat_check
  check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS', 'LABERINTO'));
```

Cambios de código asociados: `GameCategory` en `app/data/games.ts` pasa a `"ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS" | "LABERINTO"` y `CATS` en `app/data/categories.ts` añade `"LABERINTO"`. No hace falta regenerar `database.types.ts`: `cat` es `string` en el esquema generado.

---

## Plan de implementación

1. **Leer la documentación.** La guía de `node_modules/next/dist/docs/01-app` relevante para componentes cliente y `cacheComponents`, `app/lib/games/types.ts`, `app/lib/games/registry.ts` y `app/games/snake/engine.ts` como motor de ejemplo sin original. No genera código.
2. **Categoría `LABERINTO`.** Migración `supabase/migrations/YYYYMMDDHHMMSS_add_laberinto_category.sql` con el `drop`/`add constraint` de arriba, aplicada con `mcp__supabase__apply_migration`; ampliar `GameCategory` y `CATS`. Manual: `npx tsc --noEmit` sin errores, `/games` arranca, el filtro muestra la pestaña `LABERINTO` sin tarjetas, y `games_cat_check` incluye `LABERINTO`.
3. **Constantes y PRNG.** `constants.ts` con los valores de este spec y `rng.ts` con `mulberry32(seed)` y `shuffle`. Manual: `npx tsc --noEmit` y la app sigue arrancando.
4. **Laberinto y colocación.** `maze.ts` con funciones puras: `generateMaze(round)`, `bfsRooms` (con camino hacia un objetivo), `pickFlags`, `pickRivals`, `isWallAt(px, py)`. Manual: un script temporal con `tsx` (fuera de `app/`, se borra después) que para las rondas 1 a 12 imprime conexiones (339), casillas transitables (639), salas inalcanzables (0), banderas (6) y rivales (`min(4, 1 + r)`).
5. **Coche y cámara.** Movimiento en 4 direcciones con última tecla manda, colisión eje a eje, ayuda de giro y `camera(carX, carY)`. Manual: `npx tsc --noEmit`.
6. **Rivales.** Movimiento por centros de sala, decisión por BFS a la bandera más cercana, captura y choque. Manual: `npx tsc --noEmit`.
7. **Núcleo del motor.** `engine.ts`: estado en el cierre de `createBanderasGame`, `reset()`, fases, reloj, capturas, racha, puntuación, choque, sonar, rondas y fin por reloj. Sin teclado aún.
8. **Bucle y entrada.** `requestAnimationFrame` con `dt` limitado a 0,05 s; `keydown`/`keyup` en `window` ignorando `input`, `textarea` y `button`; `preventDefault` solo en flechas, `WASD`, `Espacio` y `P`; pila de teclas retenidas y `blur`. Manual: en `/games/banderas/play` el coche se mueve y la cámara lo sigue.
9. **Dibujo.** Niebla con memoria (opacidades por casilla, sin canvas auxiliar), coche, rivales, banderas, sonar con marcadores de borde, HUD y pantallas `Pulsa ESPACIO para arrancar`, `PAUSA`, `Ronda superada` y `Game over`.
10. **Ciclo de vida.** `start`, `pause`, `resume` (reinicia `lastTime`), `restart`, `end` y `destroy`; tecla `P` con `onPauseChange`; `onStats` solo cuando cambia `score`, `lives` o `level` (y al iniciar o reiniciar; el reloj no es un `GameStats`); un único `finish()` con indicador `gameOver` que llama a `onGameOver` una vez; `onRestart` al reiniciar con `Espacio` soltado tras el game over e ignorando `e.repeat`.
11. **Registro y catálogo.** Entrada `banderas` en `ENGINES` (con el `touch` mínimo); migración nueva `supabase/migrations/YYYYMMDDHHMMSS_add_banderas_game.sql` aplicada con `mcp__supabase__apply_migration`; portada `.cover-banderas` en `app/globals.css` con `/frontend-design`, verde, distinta de `.cover-frogger`.
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

- [ ] Al cargar aparece el canvas (no `.game-arena`) con el coche en `(400, 320)` de pantalla (mundo `(860, 620)`, cámara `(460, 340)`), la franja de HUD de 40 px, solo las casillas a ≤ 200 px visibles y el texto `Pulsa ESPACIO para arrancar`. El reloj marca 90 y no baja hasta pulsar `Espacio`.
- [ ] Ambos HUD (canvas y HTML) muestran puntuación 0, un `♥` y nivel 01 al empezar.
- [ ] El laberinto tiene 639 casillas transitables y 632 muros, y es el mismo en dos partidas seguidas (semilla 18019 en la ronda 1).
- [ ] Mantener `→` en un pasillo recto recorre 200 px en 1,0 s (±0,05 s). Las flechas y `WASD` conducen; al soltar, el coche se detiene en seco; con dos teclas manda la última.
- [ ] El coche no atraviesa muros con un `dt` de 0,05 s y nunca sale del mapa; la cámara nunca muestra fuera del mapa (`camX` entre 0 y 840, `camY` entre 0 y 680).
- [ ] Pedir un giro con el coche a ≤ 14 px del centro del pasillo lateral lo mete en él; a más de 14 px, no.
- [ ] Las casillas a ≤ 160 px se ven con opacidad 1, entre 160 y 200 px con 0,6, y las ya vistas fuera del radio con 0,25; las nunca vistas, en negro. Al pasar de ronda la memoria se vacía.
- [ ] Hay 6 banderas, todas a ≥ 8 pasos de sala de la salida y a Manhattan ≥ 6 entre sí, y todas alcanzables. Solo se dibujan a ≤ 200 px del coche o con el sonar activo.
- [ ] La ronda 1 tiene 2 rivales, la 2 tiene 3 y desde la 3 tiene 4. Ninguno arranca a menos de 12 pasos de sala de la salida.
- [ ] Capturar la primera bandera de la ronda en menos de 15 s suma 150 (x1) y el reloj sube 8 s; la segunda, a ≤ 15 s de la anterior, suma 300 (x2); la tercera 450 (x3); de la cuarta en adelante 600 (x4). Si pasan más de 15 s entre dos capturas, la siguiente vuelve a valer 150.
- [ ] El tiempo sube por tanto 8 s por captura propia, nunca por encima de 120.
- [ ] Un rival avanza a 140 px/s en la ronda 1 hacia la bandera restante más cercana por BFS, no hacia el coche. Si captura una bandera, esta desaparece sin puntos ni tiempo y `BANDERAS` baja en 1.
- [ ] Tocar un rival baja el reloj 3 s, pone la racha a x1 y da 1,5 s de inmunidad de choque con el coche parpadeando; durante ese tiempo no hay otro choque. El coche no se detiene ni empuja al rival.
- [ ] `Espacio` en `playing` activa el sonar: durante 1,5 s se ven todas las banderas y rivales, con marcadores a 12 px del borde para los que están fuera del visor (amarillo banderas, rojo rivales). Un segundo `Espacio` antes de 8,0 s no hace nada; la barra se llena de nuevo a los 8,0 s del primero.
- [ ] El sonar no marca como explorada ninguna casilla nueva.
- [ ] Al desaparecer la última bandera aparece `Ronda superada +N` con `N = 300 + 100 × banderas propias de la ronda`, el reloj gana 10 s, el nivel pasa a 02 en ambos HUD, el laberinto cambia (semilla 18020) y hay 3 rivales.
- [ ] Una ronda en la que el coche no capturó ninguna bandera muestra `+300`.
- [ ] Con el reloj en 0 termina la partida: el canvas muestra `Game over` con la puntuación y el HUD pasa a 0 `♥`. Un choque con menos de 3 s en el reloj también la termina.
- [ ] El reloj se detiene en pausa, en `ready` y en `clear`.
- [ ] Ambos HUD muestran siempre los mismos `score`, `lives` (1 o 0) y `level`.
- [ ] PAUSA congela coche, rivales, reloj y sonar; el canvas muestra `PAUSA` y el botón pasa a REANUDAR. La tecla `P` hace lo mismo y emite el cambio de estado a React. Al reanudar no hay salto de movimiento.
- [ ] Cambiar de pestaña con una flecha pulsada (`blur`) detiene el coche; no sigue avanzando al volver.
- [ ] Al terminar, el canvas muestra `Game over` y el modal aparece con la misma puntuación, una sola vez.
- [ ] Con `Espacio` mantenido al perder, la partida no se reinicia sola ni lanza el sonar: hay que soltar y volver a pulsar. Entonces reinicia con 0 puntos, un `♥`, nivel 01, reloj 90 y sonar disponible, y cierra el modal.
- [ ] FIN abre el modal con la puntuación actual y JUGAR DE NUEVO reinicia.
- [ ] Se puede escribir un nombre con espacios en el modal sin que `Espacio` lance el sonar o reinicie ni `P` pause.
- [ ] Salir y volver, y el doble montaje de StrictMode, no dejan dos bucles ni listeners duplicados: el reloj baja 1 por segundo (no 2), el coche recorre 200 px/s y cada pulsación de `P` pausa una sola vez.
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
- **Sí:** categoría nueva `LABERINTO` con migración del `CHECK` y cambio de `GameCategory` y `CATS`, porque el TODO dice "Requiere LABERINTO". **No:** meterlo en `ARCADE`. **Supuesto del agente.**
- **Sí:** color `green`, como pide GP-018, aunque `frogger` también lo es; la portada debe distinguirse. **No:** color nuevo.
- **Sí:** rivales que compiten por las banderas (BFS a la más cercana) y niebla con sonar de pulso. **No:** coches que persiguen al jugador, minimapa de radar continuo, combustible, humo ni rocas: es la combinación firma de un clásico concreto y no se recrea. **Supuesto del agente.**
- **Sí:** sin vidas; fin cuando el reloj llega a 0, con `lives = 1` y `0` al terminar (`initialLives: 1`), como Tetris y Snake. **No:** inventar vidas, que son la variante A.
- **Sí:** reloj de 90 s con +8 s por bandera propia, +10 s por ronda y tope de 120 s. **No:** reloj sin tope, que permitiría partidas interminables y puntuaciones muy dispersas. **Supuesto del agente.**
- **Sí:** racha con ventana de 15 s y multiplicador x1–x4, sumando los puntos con el valor previo al incremento. **No:** multiplicadores sin tope.
- **Sí:** los rivales no empujan ni matan; un choque cuesta 3 s y la racha, con 1,5 s de inmunidad. **No:** colisión física, que atascaría los pasillos de 40 px.
- **Sí:** los rivales son más lentos que el coche (190 como máximo frente a 200) y la captura gana al rival en caso de empate de frame, para que se pueda ganar la carrera con buena ruta. **No:** rivales más rápidos.
- **Sí:** laberinto por semilla (`18018 + ronda`) con árbol y 40 bucles, igual en cada partida para que el ranking sea comparable; los bucles dan rutas alternativas a los rivales y al jugador. **No:** semilla aleatoria por partida ni mapas a mano. **Supuesto del agente.**
- **Sí:** niebla por opacidad de casilla y marcadores de borde del sonar dibujados en el mismo canvas. **No:** un canvas auxiliar para la máscara (el contrato exige canvas único).
- **Sí:** `Espacio` hace de sonar en juego y de reinicio en `gameover` solo tras soltarlo e ignorando `e.repeat`, porque la misma tecla hace las dos cosas. Teclado en `window` ignorando `input`, `textarea` y `button`; `P` para pausar; `blur` suelta teclas.
- **Sí:** `K` reservada para skins y `touch` mínimo en el registro (botón A = sonar). **No:** diseñar aquí skins ni el mando táctil, que hacen `skin-designer` y `mobile-porter`.
- **Sí:** `sort_order` calculado con `max + 1` en el `insert`. **No:** fijar 7 a mano, por la discrepancia entre la migración de `horizonte` (14) y la BD (6).
- **Sí:** formas del canvas y sin sonido. **No:** inventar assets.

## Riesgos

| Riesgo                                                                            | Mitigación                                                                                                                         |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| StrictMode duplica motores                                                        | `destroy()` cancela `requestAnimationFrame` y quita todos los listeners (incluido `blur`); criterio de aceptación                  |
| El laberinto generado no es conexo o una bandera queda aislada                    | Árbol de expansión más bucles (solo abre muros); script temporal del paso 4 que comprueba 12 rondas                                |
| La colocación no encuentra 6 banderas separadas                                   | Se baja `minPair` de 6 a 3; existe solución con 6 y hay 241 a 274 candidatas por ronda                                             |
| El coche atraviesa un muro con un `dt` grande                                     | `dt` ≤ 0,05 s (paso máx. 10 px < 12 px de medio lado) y resolución eje a eje                                                       |
| Se atasca en las esquinas por los 8 px de margen                                  | Ayuda de giro de 14 px; criterio de aceptación                                                                                     |
| Los rivales ganan todas las banderas y la partida se vuelve injusta               | Rivales más lentos (140 a 190 frente a 200), 2 rivales en la ronda 1, el sonar da ventaja de ruta; las cifras se afinan en pruebas |
| Una ronda sin capturas propias da solo 300 y +10 s, lo que alarga partidas flojas | Aceptado: el reloj sigue bajando y el fin llega; el tope de 120 s limita la bolsa de tiempo                                        |
| La niebla es ilegible o fatigosa en un laberinto de 41×31                         | Radio de 200 px (5 casillas), memoria de exploración y sonar de 1,5 s cada 8 s                                                     |
| Puntuaciones muy dispersas por la racha                                           | Tope x4 y máximo de 3.600 por ronda; criterio de cifras exactas                                                                    |
| Parecido con un clásico concreto del género                                       | Lista de elementos excluidos en "Por qué existe este spec" y Decisiones; rivales competidores y sonar propios                      |
| `Espacio` pulsado en el modal lanza el sonar o reinicia                           | El teclado ignora objetivos `input`, `textarea` y `button`; criterio de aceptación                                                 |
| `Espacio` mantenido al perder reinicia al instante                                | Se ignora `e.repeat` y solo se reinicia tras `keyup`; criterio de aceptación                                                       |
| Tras pausar, el `dt` acumulado provoca un salto                                   | `lastTime` se reinicia en `resume()` y `dt` tiene tope de 0,05 s                                                                   |
| Teclas atascadas tras cambiar de pestaña                                          | `blur` suelta todas las teclas retenidas                                                                                           |
| La nueva categoría rompe el filtro o el `CHECK` en otros entornos                 | Migración propia antes de la del juego, `GameCategory` y `CATS` en el mismo paso; criterios de Catálogo                            |
| `sort_order` distinto en otro entorno                                             | `max + 1` en el `insert`; el paso 11 lo comprueba con `execute_sql`                                                                |
| Dos tarjetas verdes (`frogger`) se confunden en `/games`                          | `.cover-banderas` con composición propia (laberinto y bandera), criterio de aceptación                                             |

---

## Qué **no** está en este spec

- Sonido.
- Minimapa de radar continuo, combustible, humo, rocas y power-ups.
- Skins y ajuste del mando táctil (agentes `skin-designer` y `mobile-porter`).
- Mapas a mano, editor de laberintos y semilla elegida por el jugador.
- Vidas (la variante A las tiene).
- Récords locales y dos jugadores.
- Escalado por `devicePixelRatio`.
- Anti-trampas y tests automatizados.

Cada uno de esos puntos, si se aborda, va en su propia spec.
