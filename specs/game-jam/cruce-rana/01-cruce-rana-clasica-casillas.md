# GAME JAM — CRUCE RANA · Variante A: Clásica por casillas

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-19
> **Objective:** Crear `cruce-rana`, un juego de cruzar carretera y río saltando casilla a casilla para llenar 5 casillas de meta, con 3 vidas, tiempo por rana y niveles de velocidad creciente, como motor TypeScript con canvas único y ranking en Supabase.

---

## Por qué existe este spec

Es el resultado de la game jam con el tema "Frogger" (cruzar la carretera y el río esquivando coches, saltando sobre troncos y tortugas y llegando a las casillas de meta). Se diseña una mecánica de género original: no se reproduce ningún juego concreto (ni nombre, ni personajes, ni arte, ni música). El título, el id y el aspecto (neón de la plataforma, formas del canvas) son propios.

El catálogo ya tiene `ranaria` (ARCADE, `green`, `sort_order` 7), una simulación sin motor real (`cover-rana`). Este spec **no** la toca: crea el id nuevo `cruce-rana`, con el mismo patrón que SPEC 09 (`snake` junto a `serpentina`). `ranaria` queda como duplicado simulado. La alternativa de reutilizar el id `ranaria` está descrita en el `README.md` de la carpeta. Es un **supuesto del agente**.

Esta variante es la clásica: tres vidas, cinco casillas de meta que llenar, límite de tiempo por rana y un nivel nuevo cada vez que se llenan las cinco. La variante B comparte tablero, id y fila de `games`, pero cambia la mecánica (contrarreloj global, sin vidas ni casillas).

No hay assets de rana en `references/source-assets/` (solo `snake-assets`), así que todo se dibuja con formas del canvas y no hay sonido.

---

## Alcance

**Dentro:**

- Motor en `app/games/cruce-rana/` (TypeScript puro, sin React, sin estado global).
- Tablero de 20×15 celdas de 40 px: fila de meta, río de 5 carriles, mediana segura, carretera de 7 carriles y fila de salida.
- Salto discreto de una celda con las flechas o WASD.
- Vehículos (coches, camión, autobús) que matan al contacto; troncos y tortugas que transportan; tortugas que se sumergen cada cierto tiempo.
- 5 casillas de meta; llenarlas todas sube de nivel.
- 3 vidas, tiempo límite por rana, puntuación por avance, por casilla y por tiempo restante.
- Pantallas del canvas: inicio (`Pulsa una flecha para empezar`), `PAUSA`, `Game over`.
- Entrada en `ENGINES` con la clave `cruce-rana`.
- Fila `cruce-rana` en `games` mediante una migración nueva y portada CSS `.cover-cruce-rana`, hecha con `/frontend-design`.
- Guardado en `scores` con `game_id = 'cruce-rana'`.

**Fuera de alcance (para otros specs):**

- Sonido (no hay assets y no se inventa).
- Controles táctiles.
- Enemigos extra (serpientes, cocodrilos, nutrias), moscas o bonus en las casillas.
- Vidas extra por puntuación.
- Dos jugadores.
- Récords locales: el ranking es `scores`.
- Escalado por `devicePixelRatio`.
- Dar motor a `ranaria`, que sigue simulada.
- Anti-trampas y tests automatizados (no hay runner).
- Categoría o color nuevos: se usan `ARCADE` y `green`, que ya existen.

---

## Modelo de datos

Constantes (`app/games/cruce-rana/constants.ts`), definidas aquí porque no hay original:

```ts
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
```

Carriles (`app/games/cruce-rana/lanes.ts`). Cada objeto `k` (de 0 a `count − 1`) arranca en `x0 = k × spacing`. Posición en el instante `t` (segundos de juego): `x = ((x0 + dir × v × m × t) mod L) − len × 40`, con `L = count × spacing` y `m` el multiplicador de velocidad. En todos los carriles `L ≥ 800 + len × 40`, así que el salto de envoltura ocurre fuera de pantalla.

| Fila | Tipo                 | `dir` | `v` (px/s, nivel 1) | `len` (celdas) | `count` | `spacing` (px) | `L` (px) |
| ---- | -------------------- | ----- | ------------------- | -------------- | ------- | -------------- | -------- |
| 1    | tronco               | −1    | 90                  | 2              | 3       | 300            | 900      |
| 2    | tortuga (se sumerge) | +1    | 70                  | 3              | 3       | 320            | 960      |
| 3    | tronco               | −1    | 100                 | 4              | 2       | 480            | 960      |
| 4    | tortuga (se sumerge) | +1    | 80                  | 2              | 3       | 300            | 900      |
| 5    | tronco               | −1    | 60                  | 3              | 3       | 320            | 960      |
| 7    | coche                | +1    | 110                 | 1              | 3       | 300            | 900      |
| 8    | autobús              | −1    | 50                  | 3              | 2       | 480            | 960      |
| 9    | coche                | +1    | 90                  | 1              | 3       | 300            | 900      |
| 10   | coche rápido         | −1    | 130                 | 1              | 2       | 440            | 880      |
| 11   | camión               | +1    | 60                  | 2              | 3       | 320            | 960      |
| 12   | coche                | −1    | 100                 | 1              | 3       | 280            | 840      |
| 13   | coche                | +1    | 70                  | 1              | 3       | 320            | 960      |

Convenciones:

- Origen arriba a la izquierda. La fila `r` ocupa `y = r × 40` a `r × 40 + 40`.
- La rana tiene `row` entero y `x` en píxeles (continuo, 0 a 760). Fuera del río, `x` siempre es múltiplo de 40 (al aterrizar se redondea a la celda más cercana, `round(x / 40) × 40`, con tope 0 y 760).
- Saltos: `↑` `row − 1`, `↓` `row + 1` (no baja de la fila 14), `←` `→` `x ∓ 40` (el salto que saldría de 0..760 se ignora). Un salto por pulsación; `e.repeat` se ignora para saltar.
- Multiplicador de velocidad `m = min(2, 1 + 0,15 × (level − 1))`. Nivel 1: ×1; nivel 2: ×1,15; nivel 8 y siguientes: ×2.
- Tiempo por rana: `max(20000, 30000 − 2000 × (level − 1))` ms. Nivel 1: 30 s; nivel 6 y siguientes: 20 s.

Reglas numéricas:

- Inicio: rana en fila 14, columna 9, 3 vidas, nivel 1, puntuación 0, 5 casillas vacías, reloj de rana lleno.
- Fase `ready`: nada se mueve hasta la primera pulsación de dirección (que además salta) o `Espacio`.
- **Carretera (filas 7 a 13):** muere si su caja (28×28 centrada en la celda) solapa la caja de algún vehículo (`len × 40` de ancho × 32 de alto, centrada en la fila). Se comprueba en cada frame, no solo al saltar.
- **Río (filas 1 a 5):** sobrevive solo si el **centro horizontal** de la rana está dentro de una plataforma de su carril (`[x, x + len × 40)`) y esa plataforma no está sumergida. Mientras está sobre una plataforma, `x += dir × v × m × dt`. Muere (agua) si no hay plataforma, si la plataforma se sumerge bajo ella, o si su centro sale de `0..800` por arrastre.
- **Tortugas:** ciclo de 6000 ms por carril (misma fase para todas las tortugas del carril): 0 a 3800 ms en superficie, 3800 a 4400 aviso (parpadeo, aún seguras), 4400 a 5600 sumergidas (mortales), 5600 a 6000 emergiendo (seguras). Los troncos nunca se sumergen. La fase del carril 2 arranca en 0 ms y la del carril 4 en 3000 ms, para que no se hundan a la vez.
- **Meta (fila 0):** al saltar a la fila 0, se compara el centro de la rana con los huecos de `HOMES`. Si cae en un hueco **vacío** (`[col × 40, col × 40 + 80)`) llena la casilla y reaparece otra rana. Si cae fuera de un hueco, o en uno ya lleno, muere.
- Puntuación: `+10` la primera vez que la rana alcanza una fila más cercana a la meta que su máximo anterior (por rana; el salto a la fila 0 suma también estos 10). `+50` al llenar una casilla, más `+10 × segundos enteros restantes` del reloj. Al llenar la 5.ª casilla, `+1000` y nivel siguiente. Un salto hacia atrás o lateral no puntúa y no resta. El motor limita la puntuación a 9.999.999 (`CHECK` de `scores`).
- Muerte: la rana se pierde 900 ms (animación), `lives − 1`. Si quedan vidas reaparece en `(fila 14, col 9)` con el reloj lleno y el máximo de fila reiniciado. Si `lives = 0`, `gameover`. Durante los 900 ms no hay entrada y el reloj y los carriles siguen moviéndose.
- Reloj de rana: baja en tiempo real durante `playing`. A 0 ms muere (causa tiempo).
- Fin de nivel: al llenar la 5.ª casilla, 1500 ms de pausa (carriles parados), se vacían las casillas, `level + 1` y reaparece la rana.
- `dt` en segundos con tope de 0,05 s.
- Con la rana en la mediana (fila 6) o en la salida (fila 14) no hay peligro.

Fases: `ready` → `playing` ↔ (`dying`, `levelclear`) → `gameover`.

Mapeo a `GameStats`:

- `score`: la puntuación.
- `lives`: vidas reales (3 al empezar, 0 en `gameover`).
- `level`: nivel real, sin tope visible.

Teclas:

- `←` `↑` `→` `↓` y `A` `W` `D` `S`: saltar (en `ready`, la primera pulsación también arranca).
- `Espacio`: arranca desde `ready` y reinicia en `gameover` (emite `onRestart`). Ignora `e.repeat`.
- `P`: pausa y reanuda. Emite `onPauseChange`.

Registro:

```ts
// app/lib/games/registry.ts
ENGINES["cruce-rana"] = {
  factory: createCruceRanaGame,
  width: 800,
  height: 600,
  controls: "← ↑ → ↓ / WASD SALTAR · ESPACIO EMPEZAR/REINICIAR · P PAUSA",
  initialLives: 3,
};
```

Assets: ninguno. Rana, vehículos, troncos, tortugas, casillas y fondo se dibujan con formas del canvas en la paleta neón (rana verde, coches magenta/amarillo/cyan, troncos marrón oscuro, agua azul oscuro, asfalto gris). Sin sonido.

HUD en el canvas: fila 14 (salida) con `Puntos`, `Nivel`, vidas como iconos y barra de tiempo; las casillas llenas muestran una rana.

Fila nueva en `games` (verificada en la BD: hoy hay 8 juegos y el `sort_order` máximo es 12, `snake`):

```sql
insert into public.games (id, title, short, long, cat, cover, color, sort_order)
values (
  'cruce-rana',
  'CRUCE RANA',
  'Cruza la carretera y el río y llena las 5 casillas de meta.',
  'Salta casilla a casilla entre coches y camiones, súbete a troncos y tortugas (algunas se sumergen) y llena las 5 casillas de meta antes de que se acabe el tiempo. Tienes 3 vidas y la velocidad sube cada nivel.',
  'ARCADE',
  'cover-cruce-rana',
  'green',
  13
);
```

El texto describe el juego real: 3 vidas, tiempo por rana y niveles. Sin prometer power-ups ni modos que no existen. Puede dejar `ranaria` (`green`, `cover-rana`) con la misma tarjeta de color: la portada propia `.cover-cruce-rana` debe distinguirse de `.cover-rana`.

---

## Plan de implementación

1. **Leer la documentación.** La guía de `node_modules/next/dist/docs/01-app` sobre componentes cliente y `cacheComponents`. No genera código.
2. **Constantes y carriles.** Crear `constants.ts` y `lanes.ts` con los valores de esta spec. Manual: `npx tsc --noEmit` y la app sigue arrancando.
3. **Reglas puras.** `logic.ts` con funciones puras: `laneX(lane, t, m)`, `speedMul(level)`, `timeFor(level)`, `turtleState(phaseMs)`, `platformAt(row, centerX, state)`, `hitsVehicle(frog, state)`, `homeAt(centerX, filled)`. Manual: `npx tsc --noEmit`.
4. **Núcleo del motor.** `engine.ts`: estado en el cierre de `createCruceRanaGame`, `reset()`, fases, salto con bloqueo de 90 ms, arrastre en el río, colisiones, reloj, casillas, puntuación, vidas, nivel. Sin teclado aún.
5. **Bucle y entrada.** `requestAnimationFrame` con `dt` limitado a 0,05 s, teclado en `window` ignorando `input`, `textarea` y `button`, `preventDefault` solo en flechas, `WASD`, `Espacio` y `P`. Manual: en `/games/cruce-rana/play` la rana salta, muere y llena casillas.
6. **Dibujo.** Fondo por zonas, carriles, rana con ojos que miran en la dirección del último salto, animación de muerte, parpadeo de tortugas, HUD del canvas y pantallas `Pulsa una flecha para empezar`, `PAUSA`, `Game over`.
7. **Ciclo de vida.** `start`, `pause`, `resume`, `restart`, `end`, `destroy`; tecla `P`; `onStats` solo cuando cambia un valor; un único `finish()` con indicador `gameOver` que llama a `onGameOver` una vez; `onRestart` al reiniciar con `Espacio` ignorando `e.repeat`.
8. **Registro y catálogo.** Entrada `cruce-rana` en `ENGINES`; migración nueva en `supabase/migrations/` aplicada con `mcp__supabase__apply_migration`; portada `.cover-cruce-rana` en `app/globals.css` con `/frontend-design`.
9. **Repaso.** `npm run lint`, `npx tsc --noEmit`, `npm run build`, partida completa guardada y comprobada en `/games/cruce-rana`, `/hall-of-fame` y `/`, consola, `get_advisors`, retirada de código muerto.

---

## Criterios de aceptación

**Calidad**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] La consola no muestra errores ni avisos de React en `/games/cruce-rana/play`.
- [ ] A 375 px de ancho no hay scroll horizontal y el canvas no se deforma.
- [ ] Asteroides, Tetris, Arkanoid y Snake conservan su canvas, su línea de controles y sus vidas iniciales (3, 1, 3 y 1).
- [ ] StrictMode (doble montaje) y salir y volver no dejan dos bucles ni listeners duplicados: un coche del carril 13 recorre 70 px en 1 s, no 140.
- [ ] El teclado se escucha en `window` e ignora `input`, `textarea` y `button`; en el modal se escribe un nombre con espacios sin que `Espacio` arranque o reinicie ni `P` pause.

**Catálogo**

- [ ] `/games` muestra 9 tarjetas y la de CRUCE RANA tiene portada propia `.cover-cruce-rana`, distinta de `.cover-rana`.
- [ ] `/games/cruce-rana` y `/games/cruce-rana/play` responden 200.
- [ ] `games` contiene la fila `cruce-rana` (`ARCADE`, `green`, `sort_order` 13) y `list_migrations` lista la migración.
- [ ] La fila `ranaria` no cambia y sigue con simulación y sin botón de guardar.

**Juego**

- [ ] Al cargar aparece el canvas (no `.game-arena`) con 15 filas: meta (5 huecos de 80 px en x = 40, 200, 360, 520, 680), río de 5 filas, mediana, carretera de 7 filas y salida. La rana está en fila 14, columna 9, y se ve `Pulsa una flecha para empezar`. Nada se mueve hasta pulsar.
- [ ] Ambos HUD (canvas y HTML) muestran puntuación 0, 3 `♥` y nivel 01 al empezar.
- [ ] Cada pulsación salta exactamente una celda (40 px) y mantener la tecla no encadena saltos. Una pulsación durante los 90 ms del salto se ignora. Un salto lateral fuera de 0..760 se ignora.
- [ ] Avanzar a una fila nueva suma exactamente 10; volver atrás y avanzar de nuevo a una fila ya alcanzada no suma.
- [ ] Tocar un vehículo en la carretera mata a la rana: animación de 900 ms, un `♥` menos en ambos HUD y reaparición en fila 14, columna 9 con el reloj lleno.
- [ ] En el río, estar fuera de cualquier plataforma mata; sobre un tronco la rana se desplaza con él a la velocidad del carril (carril 1: 90 px/s hacia la izquierda en el nivel 1); ser arrastrada fuera de pantalla mata.
- [ ] Las tortugas se sumergen en ciclos de 6000 ms: parpadean de 3800 a 4400 ms y matan a la rana encima de 4400 a 5600 ms. Los carriles 2 y 4 no se sumergen a la vez.
- [ ] Saltar a un hueco de meta vacío suma `10` (fila) + `50` + `10 × segundos enteros restantes` y muestra una rana en el hueco. Saltar a la fila 0 fuera de un hueco, o a un hueco ya lleno, mata.
- [ ] Al llenar la 5.ª casilla se suman 1000, se muestra una pausa de 1500 ms, las casillas se vacían y el nivel pasa a 02 en ambos HUD. Los carriles van a ×1,15 de velocidad (carril 13: 80,5 px/s) y el reloj de rana es de 28 s. En el nivel 8 el multiplicador es ×2 y no sube más; en el nivel 6 el reloj es de 20 s y no baja más.
- [ ] Al llegar el reloj a 0 la rana muere y se pierde una vida.
- [ ] Al perder la tercera vida el canvas muestra `Game over` con la puntuación y el HUD pasa a 0 `♥`.
- [ ] Ambos HUD muestran siempre los mismos `score`, `lives` y `level`.
- [ ] PAUSA congela los carriles, el reloj y el movimiento; el canvas muestra `PAUSA` y el botón pasa a REANUDAR. La tecla `P` hace lo mismo y avisa a React. Al reanudar no hay salto de posición.
- [ ] Al terminar el modal aparece con la misma puntuación, una sola vez (`onGameOver` una vez).
- [ ] `Espacio` en `Game over` reinicia con puntuación 0, 3 `♥` y nivel 01, y cierra el modal. Si la tecla seguía pulsada (`e.repeat`), no reinicia hasta soltarla y volver a pulsar.
- [ ] FIN abre el modal con la puntuación actual y JUGAR DE NUEVO reinicia.
- [ ] La línea de controles aparece en `/games/cruce-rana/play` con las teclas de este juego y no en juegos sin motor.

**Leaderboard**

- [ ] GUARDAR PUNTUACIÓN inserta en `scores` una fila con `game_id = 'cruce-rana'`, el nombre y la puntuación del modal. Un doble clic crea una sola fila.
- [ ] Tras guardar, `/games/cruce-rana` la muestra en `#01`, `Partidas` y `Mejor global` se actualizan, y aparece en `/hall-of-fame` y en la actividad de `/`.
- [ ] Los juegos sin motor siguen con simulación y sin botón de guardar.
- [ ] Tras las pruebas, `scores` no contiene filas de prueba.
- [ ] Una búsqueda de `service_role` en `app/` no da resultados.

---

## Decisiones

- **Sí:** id nuevo `cruce-rana` y título propio. **No:** reutilizar el id `ranaria` (supuesto del agente: mismo criterio que `snake` y `serpentina`; ver README) ni usar el nombre del juego que inspira el tema.
- **Sí:** tres vidas, 5 casillas, reloj por rana y niveles (variante clásica). **No:** contrarreloj global ni sin vidas: es la variante B.
- **Sí:** salto discreto de una celda con bloqueo de 90 ms e ignorando `e.repeat`. **No:** movimiento continuo o saltos encadenados al mantener la tecla.
- **Sí:** rana con `x` continua en el río y aterrizaje redondeado a celda fuera de él. **No:** rana siempre pegada a la rejilla (impediría el arrastre).
- **Sí:** supervivencia en el río por el centro de la rana dentro de la plataforma. **No:** solape parcial, que haría el río demasiado permisivo.
- **Sí:** puntuación por fila nueva, casilla, tiempo restante y fin de nivel. **No:** puntos por saltos laterales o hacia atrás ni penalizaciones.
- **Sí:** tortugas con ciclo de 6000 ms y aviso visible de 600 ms. **No:** hundimientos aleatorios, que impedirían criterios exactos.
- **Sí:** `lives` y `level` reales, `initialLives: 3`. **No:** valores fijos.
- **Sí:** formas del canvas y sin sonido. **No:** inventar assets de rana ni audio.
- **Sí:** `Espacio` reinicia ignorando `e.repeat`; teclado en `window` ignorando `input`, `textarea` y `button`; `P` pausa. Patrón de SPEC 05, 07 y 08.
- **Sí:** color `green` y categoría `ARCADE` existentes, portada propia `.cover-cruce-rana`. **No:** categoría nueva.
- **Sí (supuesto del agente):** `sort_order` 13 y 3 vidas fijas sin vida extra. **No:** vidas por puntos.

## Riesgos

| Riesgo                                                                      | Mitigación                                                                                                           |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| StrictMode duplica motores                                                  | `destroy()` cancela `requestAnimationFrame` y quita todos los listeners; criterio de aceptación                      |
| Parecido excesivo con el juego que inspira el tema                          | Título, id, aspecto neón y números propios; solo se reutilizan mecánicas de género                                   |
| Dos tarjetas verdes de rana (`ranaria` y `cruce-rana`) confunden al jugador | Portada distinta; el README propone la alternativa de reemplazar `ranaria`                                           |
| Río injusto por colisiones de borde                                         | Regla del centro de la rana dentro de la plataforma y valores numéricos fijos en la tabla de carriles                |
| Salto de envoltura visible de vehículos o plataformas                       | `L ≥ 800 + len × 40` en todos los carriles; comprobado en el paso 3                                                  |
| Tras pausar, el tiempo salta                                                | `lastTime` se reinicia en `resume()`; el reloj y los carriles usan `dt` y no tiempo absoluto; criterio de aceptación |
| Mantener una flecha hace saltar en cadena                                   | Se ignora `e.repeat` y hay bloqueo de 90 ms; criterio de aceptación                                                  |
| `Espacio` mantenido al perder reinicia al instante                          | Se ignora `e.repeat`; criterio de aceptación                                                                         |
| Dificultad inabordable a nivel alto                                         | Tope ×2 de velocidad y reloj mínimo de 20 s                                                                          |
| Puntuación fuera del `CHECK` de `scores`                                    | El motor la limita a 9.999.999                                                                                       |

---

## Qué **no** está en este spec

- Sonido.
- Controles táctiles.
- Enemigos extra, moscas y bonus.
- Vidas extra por puntuación.
- Modo contrarreloj global (variante B).
- Dos jugadores.
- Récords locales.
- Escalado por `devicePixelRatio`.
- Dar motor a `ranaria`.
- Anti-trampas y tests automatizados.

Cada uno de esos puntos, si se aborda, va en su propia spec.
