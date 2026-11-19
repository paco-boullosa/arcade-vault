# GAME JAM — CRUCE RANA · Variante B: Contrarreloj con racha

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-19
> **Objective:** Crear `cruce-rana` como contrarreloj de 120 s en la que se cruza una y otra vez carretera y río, sin vidas ni casillas, con multiplicador de racha por cruces sin morir y penalización de tiempo al morir, como motor TypeScript con canvas único y ranking en Supabase.

---

## Por qué existe este spec

Es la segunda variante de la game jam con el tema "Frogger" (cruzar la carretera y el río esquivando coches y saltando sobre troncos y tortugas). Comparte con la variante A el id `cruce-rana`, el título, la categoría, el color, el tablero y la fila de `games`, pero la mecánica es distinta: no hay vidas ni casillas de meta. Hay un reloj global de 120 s, la orilla superior es una meta continua, cada cruce completo puntúa con un multiplicador de racha, y morir cuesta 5 s de reloj y rompe la racha. Es una partida corta con puntuación abierta, pensada para un ranking en el que importa cuántos cruces seguidos se hacen sin fallar.

No se reproduce ningún juego concreto (nombre, personajes, arte ni música). El catálogo ya tiene `ranaria` (ARCADE, `green`, `sort_order` 7), una simulación sin motor. Este spec crea el id nuevo `cruce-rana` y no la toca (mismo criterio que SPEC 09 con `snake` y `serpentina`). Reemplazarla se discute en el `README.md`. Es un **supuesto del agente**.

No hay assets de rana en `references/source-assets/` (solo `snake-assets`): todo con formas del canvas y sin sonido.

---

## Alcance

**Dentro:**

- Motor en `app/games/cruce-rana/` (TypeScript puro, sin React, sin estado global).
- Tablero de 20×15 celdas de 40 px: orilla de meta (fila 0), río de 5 carriles, mediana segura, carretera de 7 carriles y fila de salida.
- Salto discreto de una celda con las flechas o WASD.
- Vehículos que matan, troncos y tortugas que transportan, tortugas que se sumergen.
- Reloj global de 120 s, bonus de +3 s por cruce, penalización de 5 s por muerte.
- Racha: multiplicador de 1 a 5 según cruces seguidos sin morir.
- Nivel por cruces con velocidad creciente.
- Pantallas del canvas: inicio (`Pulsa una flecha para empezar`), `PAUSA`, `Game over` (tiempo agotado).
- Entrada en `ENGINES` con la clave `cruce-rana`.
- Fila `cruce-rana` en `games` mediante una migración nueva y portada CSS `.cover-cruce-rana`, hecha con `/frontend-design`.
- Guardado en `scores` con `game_id = 'cruce-rana'`.

**Fuera de alcance (para otros specs):**

- Sonido (no hay assets y no se inventa).
- Controles táctiles.
- Vidas, casillas de meta y llenar huecos (variante A).
- Enemigos extra, moscas y bonus.
- Dos jugadores.
- Récords locales: el ranking es `scores`.
- Escalado por `devicePixelRatio`.
- Dar motor a `ranaria`, que sigue simulada.
- Anti-trampas y tests automatizados (no hay runner).
- Categoría o color nuevos: se usan `ARCADE` y `green`.

---

## Modelo de datos

Constantes (`app/games/cruce-rana/constants.ts`), definidas aquí porque no hay original:

```ts
export const W = 800;
export const H = 600;
export const CELL = 40;
export const COLS = W / CELL; // 20
export const ROWS = H / CELL; // 15

export const ROW_GOAL = 0; // orilla segura de meta (toda la fila)
export const ROW_RIVER_TOP = 1; // filas 1..5 = río
export const ROW_RIVER_BOTTOM = 5;
export const ROW_MEDIAN = 6;
export const ROW_ROAD_TOP = 7; // filas 7..13 = carretera
export const ROW_ROAD_BOTTOM = 13;
export const ROW_START = 14;

export const CFG = {
  startCol: 9, // x = 360
  totalMs: 120000, // reloj global al empezar
  clockCapMs: 150000, // el reloj nunca pasa de este valor
  crossBonusMs: 3000, // se suma al completar un cruce
  deathPenaltyMs: 5000, // se resta al morir
  hopMs: 90, // animación del salto; durante ella no se acepta otra pulsación
  frogHit: 28,
  vehicleHitH: 32,
  deathMs: 600, // animación de muerte (el reloj se detiene)
  arriveMs: 300, // animación de llegada (el reloj sigue)
  pointsRow: 5, // por cada fila nueva alcanzada en este cruce
  pointsCross: 100, // × multiplicador de racha
  multMax: 5,
  crossingsPerLevel: 3,
  speedPerLevel: 0.1, // +10 % de velocidad por nivel
  speedMax: 1.8,
  diveCycleMs: 6000,
  diveWarnFrom: 3800,
  diveSubFrom: 4400,
  diveSubTo: 5600,
};
```

Carriles (`app/games/cruce-rana/lanes.ts`). Cada objeto `k` (de 0 a `count − 1`) arranca en `x0 = k × spacing`. Posición en el instante `t` (segundos de juego): `x = ((x0 + dir × v × m × t) mod L) − len × 40`, con `L = count × spacing` y `m` el multiplicador de velocidad. En todos los carriles `L ≥ 800 + len × 40`.

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
- La rana tiene `row` entero y `x` en píxeles (0 a 760). Fuera del río, `x` es múltiplo de 40 (al aterrizar se redondea con `round(x / 40) × 40`, tope 0 y 760).
- Saltos: `↑` `row − 1`, `↓` `row + 1` (no baja de la 14), `←` `→` `x ∓ 40` (el salto que saldría de 0..760 se ignora). Un salto por pulsación; `e.repeat` se ignora para saltar.
- Los carriles usan el reloj de **juego** `t`, que avanza solo mientras el reloj global corre (no durante la animación de muerte ni en pausa).
- Nivel: `level = 1 + floor(cruces / 3)`. Multiplicador de velocidad `m = min(1,8, 1 + 0,1 × (level − 1))`: nivel 1 ×1; nivel 2 ×1,1; nivel 9 y siguientes ×1,8.
- Regla de nivel: `m` se actualiza **solo al empezar cada cruce** (al reaparecer la rana en la fila 14), nunca a mitad de un cruce. Para evitar saltos de posición, cada carril guarda un desplazamiento `phase` y se usa `x = ((x0 + phase + dir × v × m × (t − t0)) mod L) − len × 40`, con `t0` el instante del cambio y `phase` la posición acumulada hasta entonces.

Reglas numéricas:

- Inicio: rana en fila 14, columna 9, reloj 120000 ms, puntuación 0, racha 0, 0 cruces, nivel 1.
- Fase `ready`: nada se mueve hasta la primera pulsación de dirección (que salta) o `Espacio`; el reloj empieza en ese momento.
- **Carretera (filas 7 a 13):** muere si su caja (28×28 centrada en la celda) solapa la caja de un vehículo (`len × 40` × 32, centrada en la fila). Comprobado cada frame.
- **Río (filas 1 a 5):** sobrevive solo si el **centro horizontal** de la rana está dentro de una plataforma de su carril (`[x, x + len × 40)`) y no está sumergida. Sobre una plataforma, `x += dir × v × m × dt`. Muere si no hay plataforma, si se sumerge bajo ella o si su centro sale de `0..800`.
- **Tortugas:** ciclo de 6000 ms por carril: 0 a 3800 ms superficie, 3800 a 4400 aviso (parpadeo, seguras), 4400 a 5600 sumergidas (mortales), 5600 a 6000 emergiendo (seguras). La fase del carril 2 arranca en 0 ms y la del carril 4 en 3000 ms.
- **Meta (fila 0):** toda la fila es orilla segura. Al llegar a ella (cualquier columna) se completa un cruce.
- **Cruce completado:** `cruces + 1`; puntuación `+5` por la fila 0 (cuenta como fila nueva) y `+100 × mult`, con `mult = min(5, 1 + racha)` calculado **antes** de incrementar la racha; después `racha + 1`; reloj `+3000 ms` (tope 150000 ms); animación de llegada de 300 ms; la rana reaparece en `(14, 9)`; se recalcula `level` y `m`. El primer cruce vale 100, el segundo seguido 200, el tercero 300, el cuarto 400 y del quinto en adelante 500.
- **Puntos por fila:** `+5` la primera vez que la rana alcanza, en este cruce, una fila más cercana a la meta que su máximo anterior. Se reinicia al reaparecer. Saltos laterales y hacia atrás no puntúan ni restan.
- **Muerte:** `racha = 0`, reloj `− 5000 ms` en el momento de morir (mínimo 0), animación de 600 ms con el reloj y los carriles detenidos, reaparición en `(14, 9)` con el máximo de fila reiniciado. No cuenta como cruce y la puntuación no baja.
- **Fin:** cuando el reloj llega a 0 ms (por tiempo o por la penalización de una muerte) la partida termina al instante con `Game over`, sin esperar la animación de muerte.
- Puntuación limitada en el motor a 9.999.999 (`CHECK` de `scores`).
- `dt` en segundos con tope de 0,05 s. Sin peligro en la mediana ni en la salida.

Fases: `ready` → `playing` ↔ (`dying`, `arriving`) → `gameover`.

Mapeo a `GameStats`:

- `score`: la puntuación.
- `lives`: `1` mientras se juega y `0` en `gameover` (juego sin vidas; contrato de SPEC 09).
- `level`: nivel real `1 + floor(cruces / 3)`, sin tope visible.

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
  initialLives: 1,
};
```

Assets: ninguno. Todo con formas del canvas en la paleta neón; sin sonido.

HUD en el canvas (fila 14): `Puntos`, `Nivel`, reloj en segundos (`120`), multiplicador (`x1` a `x5`) y racha.

Fila nueva en `games` (verificada en la BD: hoy hay 8 juegos y el `sort_order` máximo es 12, `snake`):

```sql
insert into public.games (id, title, short, long, cat, cover, color, sort_order)
values (
  'cruce-rana',
  'CRUCE RANA',
  'Cruza carretera y río tantas veces como puedas en 120 segundos.',
  'Contrarreloj de 120 segundos: salta entre coches y camiones, súbete a troncos y tortugas y llega a la orilla. Cada cruce suma tiempo y puntos, y encadenarlos sin morir multiplica la puntuación hasta x5. Morir resta 5 segundos y rompe la racha.',
  'ARCADE',
  'cover-cruce-rana',
  'green',
  13
);
```

El texto describe el juego real: sin vidas, sin casillas, con reloj y racha.

---

## Plan de implementación

1. **Leer la documentación.** La guía de `node_modules/next/dist/docs/01-app` sobre componentes cliente y `cacheComponents`. No genera código.
2. **Constantes y carriles.** `constants.ts` y `lanes.ts` con los valores de esta spec. Manual: `npx tsc --noEmit` y la app sigue arrancando.
3. **Reglas puras.** `logic.ts`: `laneX(lane, state)`, `speedMul(level)`, `levelFor(cruces)`, `multFor(racha)`, `turtleState(phaseMs)`, `platformAt`, `hitsVehicle`, `crossScore`. Manual: `npx tsc --noEmit`.
4. **Núcleo del motor.** `engine.ts`: estado en el cierre, `reset()`, fases, salto con bloqueo, arrastre, colisiones, reloj global, cruces, racha, penalización, `phase` de carriles al cambiar `m`. Sin teclado aún.
5. **Bucle y entrada.** `requestAnimationFrame` con `dt` limitado a 0,05 s, teclado en `window` ignorando `input`, `textarea` y `button`, `preventDefault` solo en teclas del juego. Manual: en `/games/cruce-rana/play` la rana salta, cruza y puntúa.
6. **Dibujo.** Fondo por zonas, carriles, rana, animaciones de muerte y llegada, parpadeo de tortugas, HUD del canvas con reloj y multiplicador, pantallas `Pulsa una flecha para empezar`, `PAUSA`, `Game over`.
7. **Ciclo de vida.** `start`, `pause`, `resume`, `restart`, `end`, `destroy`; tecla `P`; `onStats` solo cuando cambia un valor; un único `finish()` con indicador `gameOver` que llama a `onGameOver` una vez; `onRestart` al reiniciar con `Espacio` ignorando `e.repeat`.
8. **Registro y catálogo.** Entrada `cruce-rana` en `ENGINES`; migración nueva aplicada con `mcp__supabase__apply_migration`; portada `.cover-cruce-rana` con `/frontend-design`.
9. **Repaso.** `npm run lint`, `npx tsc --noEmit`, `npm run build`, partida guardada y comprobada en `/games/cruce-rana`, `/hall-of-fame` y `/`, consola, `get_advisors`, retirada de código muerto.

---

## Criterios de aceptación

**Calidad**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] La consola no muestra errores ni avisos de React en `/games/cruce-rana/play`.
- [ ] A 375 px de ancho no hay scroll horizontal y el canvas no se deforma.
- [ ] Asteroides, Tetris, Arkanoid y Snake conservan su canvas, su línea de controles y sus vidas iniciales (3, 1, 3 y 1).
- [ ] StrictMode (doble montaje) y salir y volver no dejan dos bucles ni listeners duplicados: el reloj baja 1 s por segundo real, no 2.
- [ ] El teclado se escucha en `window` e ignora `input`, `textarea` y `button`; en el modal se escribe un nombre con espacios sin que `Espacio` arranque o reinicie ni `P` pause.

**Catálogo**

- [ ] `/games` muestra 9 tarjetas y la de CRUCE RANA tiene portada propia `.cover-cruce-rana`, distinta de `.cover-rana`.
- [ ] `/games/cruce-rana` y `/games/cruce-rana/play` responden 200.
- [ ] `games` contiene la fila `cruce-rana` (`ARCADE`, `green`, `sort_order` 13) y `list_migrations` lista la migración.
- [ ] La fila `ranaria` no cambia y sigue con simulación y sin botón de guardar.

**Juego**

- [ ] Al cargar aparece el canvas (no `.game-arena`) con 15 filas: orilla de meta, río de 5 filas, mediana, carretera de 7 filas y salida. La rana está en fila 14, columna 9, el reloj marca 120 y se ve `Pulsa una flecha para empezar`. El reloj no baja hasta la primera pulsación.
- [ ] Ambos HUD muestran puntuación 0, un `♥` y nivel 01 al empezar.
- [ ] Cada pulsación salta exactamente 40 px y mantener la tecla no encadena saltos. Una pulsación durante los 90 ms del salto se ignora.
- [ ] Alcanzar una fila nueva suma exactamente 5; volver atrás y avanzar a una fila ya alcanzada en ese cruce no suma.
- [ ] Tocar un vehículo, caer al agua, ser arrastrado fuera de pantalla o estar sobre una tortuga sumergida mata: animación de 600 ms con reloj y carriles parados, reloj −5 s, racha 0, reaparición en fila 14, columna 9.
- [ ] Sobre un tronco la rana se desplaza a la velocidad del carril (carril 1: 90 px/s hacia la izquierda en el nivel 1).
- [ ] Las tortugas parpadean de 3800 a 4400 ms y matan de 4400 a 5600 ms; los carriles 2 y 4 no se sumergen a la vez.
- [ ] Llegar a la fila 0 en cualquier columna completa un cruce. Un primer cruce limpio (14 filas nuevas × 5 = 70, más 100 × 1) suma 170 en ambos HUD. Cruces seguidos sin morir suman 100 × 2, 100 × 3, 100 × 4 y 100 × 5 (más 70 de filas cada uno) y el multiplicador se queda en x5.
- [ ] Un cruce suma 3 s al reloj (tope 150 s) y la rana reaparece en fila 14 tras 300 ms.
- [ ] Morir pone la racha a 0: el siguiente cruce vuelve a valer 100. La puntuación nunca baja.
- [ ] A los 3 cruces el nivel pasa a 02 en ambos HUD y los carriles van a ×1,1 (carril 13: 77 px/s) desde el cruce siguiente, sin saltos de posición. En el nivel 9 el multiplicador es ×1,8 y no sube más.
- [ ] Cuando el reloj llega a 0 (por tiempo o por penalización) el canvas muestra `Game over` con la puntuación y el HUD pasa a 0 `♥`.
- [ ] Ambos HUD muestran siempre los mismos `score`, `lives` y `level`.
- [ ] PAUSA congela reloj, carriles y rana; el canvas muestra `PAUSA` y el botón pasa a REANUDAR. La tecla `P` hace lo mismo y avisa a React. Al reanudar no hay salto de posición ni de reloj.
- [ ] Al terminar el modal aparece con la misma puntuación, una sola vez.
- [ ] `Espacio` en `Game over` reinicia con puntuación 0, reloj 120, racha 0, un `♥` y nivel 01, y cierra el modal. Con `e.repeat` no reinicia hasta soltar y volver a pulsar.
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

- **Sí:** id nuevo `cruce-rana`, título propio. **No:** reutilizar el id `ranaria` (supuesto del agente; ver README) ni el nombre del juego que inspira el tema.
- **Sí:** reloj global de 120 s, orilla meta continua y racha. **No:** vidas ni casillas (variante A).
- **Sí:** morir resta 5 s y rompe la racha, sin restar puntos. **No:** perder puntuación (el ranking se leería como castigo doble).
- **Sí:** +3 s por cruce con tope de 150 s. **No:** reloj ilimitado, que permitiría partidas eternas.
- **Sí:** multiplicador `min(5, 1 + racha)` calculado antes de incrementar la racha. **No:** multiplicador por nivel.
- **Sí:** la velocidad cambia solo al empezar un cruce y con `phase` acumulada para evitar saltos. **No:** cambiarla a mitad de cruce.
- **Sí:** salto discreto con bloqueo de 90 ms e ignorando `e.repeat`. **No:** saltos encadenados al mantener la tecla.
- **Sí:** río con regla del centro de la rana dentro de la plataforma. **No:** solape parcial.
- **Sí:** `lives = 1` y `0` al terminar, `initialLives: 1`, `level` por cruces. **No:** inventar vidas.
- **Sí:** formas del canvas y sin sonido. **No:** inventar assets ni audio.
- **Sí:** `Espacio` reinicia ignorando `e.repeat`; teclado en `window` ignorando `input`, `textarea` y `button`; `P` pausa.
- **Sí:** categoría `ARCADE`, color `green`, portada propia `.cover-cruce-rana`. **No:** categoría nueva.
- **Sí (supuesto del agente):** `sort_order` 13 y velocidad con tope ×1,8 (menor que la A porque aquí no hay vidas).

## Riesgos

| Riesgo                                                           | Mitigación                                                                                      |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| StrictMode duplica motores                                       | `destroy()` cancela `requestAnimationFrame` y quita todos los listeners; criterio de aceptación |
| Parecido excesivo con el juego que inspira el tema               | Título, id, aspecto neón y números propios; solo mecánicas de género                            |
| Dos tarjetas verdes de rana confunden                            | Portada distinta; el README propone la alternativa de reemplazar `ranaria`                      |
| Partidas sin fin por bonus de tiempo                             | Tope de reloj 150 s, bonus fijo de 3 s y velocidad creciente                                    |
| La racha dispara la puntuación y desequilibra el ranking         | Multiplicador con tope x5; puntuación limitada a 9.999.999                                      |
| Saltos de posición al subir de nivel                             | Cambio de `m` solo al empezar cruce, con `phase` acumulada                                      |
| Reloj de juego y reloj de pared desincronizados tras pausa       | `lastTime` se reinicia en `resume()`; reloj y carriles usan `dt`; criterio de aceptación        |
| Mantener una flecha hace saltar en cadena                        | Se ignora `e.repeat` y bloqueo de 90 ms                                                         |
| `Espacio` mantenido al perder reinicia al instante               | Se ignora `e.repeat`; criterio de aceptación                                                    |
| Penalización que acaba la partida durante la animación de muerte | Regla explícita: el fin se declara al llegar el reloj a 0, sin animación adicional              |

---

## Qué **no** está en este spec

- Sonido.
- Controles táctiles.
- Vidas y casillas de meta (variante A).
- Enemigos extra, moscas y bonus.
- Dos jugadores.
- Récords locales.
- Escalado por `devicePixelRatio`.
- Dar motor a `ranaria`.
- Anti-trampas y tests automatizados.

Cada uno de esos puntos, si se aborda, va en su propia spec.
