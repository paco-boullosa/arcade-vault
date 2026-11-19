# SPEC 07 — Juego Tetris integrado con su leaderboard

> **Status:** Aprobado
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-11-19
> **Objective:** Portar `references/started-games/03-tetris/` a un motor TypeScript con su canvas, modos de juego, power-ups y skins, que notifica a React, y publicarlo como juego nuevo `tetris` con su ranking en Supabase.

---

## Por qué existe este spec

Es el segundo juego real tras Asteroides (SPEC 05) y el primero que reutiliza el leaderboard genérico de SPEC 06. El original es un `game.js` de 906 líneas con estado global, dos canvas, un menú de modos en DOM, cinco desafíos, cuatro skins, power-ups, récords en `localStorage` y un panel lateral HTML. Se porta como motor en TypeScript puro, sin estado global, para poder crear y destruir instancias (StrictMode monta dos veces).

El usuario ha decidido portar todos los extras (pieza fantasma, power-ups, skins y desafíos) y crear un id nuevo `tetris`, sin tocar el juego simulado `caida`. Como la plataforma ya aporta HUD, pausa, fin de partida, modal y ranking, la capa DOM del original se redibuja dentro de un único canvas de 800×600: tablero a la izquierda, panel lateral y menú de modos dibujados en el mismo canvas.

Hay tres acoplamientos a Asteroides que este spec resuelve antes de portar nada: `GameCanvas` importa `W`/`H` de Asteroides, `GamePlayer` escribe literal la línea de controles y fija 3 vidas al reiniciar el HUD. Tetris tiene 1 vida, así que sin ese cambio el HUD mostraría tres corazones.

---

## Alcance

**Dentro:**

- Generalización: `GameDefinition` en `app/lib/games/registry.ts` con `factory`, `width`, `height`, `controls` e `initialLives`. `GameCanvas` y `GamePlayer` leen de ahí. Asteroides sigue igual.
- Motor en `app/games/tetris/` (TypeScript puro, sin React, sin estado global).
- Reglas del original: tablero 10×20, 7 piezas, rotación con wall kicks `[0, -1, 1, -2, 2]`, soft drop, hard drop, pieza fantasma (tecla `G`), vista previa de la siguiente pieza, puntuación, niveles y velocidad.
- Los 5 power-ups (Bomba, Rayo, Tinte, Gravedad, Congelar), uno cada 5 líneas, en todos los modos.
- Los 6 modos: Clásico y los 5 desafíos (Sprint 40, Marea de basura, Bloques fijos, Piezas fantasma, Rotación inversa).
- Las 4 skins (Retro, Neon, Pastel, Pixel art), cambiables con la tecla `S`. La elección se guarda en `localStorage` con la clave `tetris.skin`.
- Menú de modos dibujado en el canvas antes de cada partida.
- Entrada en `ENGINES` con la clave `tetris`.
- Fila `tetris` en `games` mediante una migración nueva y portada CSS `.cover-tetris`.
- Guardado en `scores` con `game_id = 'tetris'`, igual para los 6 modos.

**Fuera de alcance (para otros specs):**

- Récords locales (`tetris.records.v1`), mejor combo y máximo de líneas. El ranking es `scores`.
- Selector de nivel inicial de la pausa (`chosenLevel`). El nivel inicial es siempre 1, salvo Rotación inversa, que empieza en 5.
- El menú de pausa del original (Reanudar, Reiniciar, Ver controles) y su overlay DOM: la plataforma aporta PAUSA, FIN y JUGAR DE NUEVO.
- Campo `mode` en `scores` y rankings separados por modo.
- Bonus de puntuación por superar un desafío.
- Controles táctiles y versión móvil.
- Sonido (el original no tiene).
- Escalado por `devicePixelRatio`. La resolución interna es fija.
- Anti-trampas en el guardado de puntuaciones.
- Portar Arkanoid y dar motor a `caida`, que sigue simulado.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

Constantes del original, sin cambios de valor (`app/games/tetris/constants.ts`):

```ts
export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30; // tablero 300×600
export const LINE_SCORES = [0, 100, 300, 500, 800];
export const POWER_EVERY = 5; // líneas entre power-ups
export const FREEZE_MS = 5000;
export const WILD_MS = 400;
export const FLASH_MS = 800;
export const GARBAGE_EVERY = 10000; // ms
export const TIME_LIMIT = 120000; // ms
```

Reglas numéricas, sacadas de `game.js` (no del README):

- Línea(s): `puntos = LINE_SCORES[n] × level`, con el `level` anterior a recalcularlo. Después `level = startLevel + floor(lines / 10)`.
- Velocidad: `dropInterval = max(100, 1000 - (level - 1) × 90)` ms.
- Soft drop (`↓`): +1 por fila bajada. Si la pieza no puede bajar, se fija y no suma.
- Hard drop (`Espacio`): +2 por celda recorrida.
- Aparición: `x = 5 - floor(ancho / 2)`, `y = 0`. Si la pieza aparece colisionando, fin de partida.
- El tiempo (`elapsed`) no avanza en pausa. Con Congelar activo la caída automática se detiene, pero `elapsed` sigue.

Resolución interna: **800×600**. Tablero 300×600 en `x = 40`, panel lateral desde `x = 380` con `SCORE`, `LINES`, `LEVEL`, `NEXT` (4×4 celdas), estado del power-up, nombre de la skin y, en desafíos, objetivo y progreso.

Mapeo a `GameStats`:

- `score`: la puntuación, limitada a 9.999.999 (`CHECK` de `scores`).
- `lives`: `1` mientras se juega o se ve el menú, `0` al terminar.
- `level`: `startLevel + floor(lines / 10)`. Vale 1 al empezar, salvo Rotación inversa, que vale 5.

Teclas:

- `←` `→` mover, `↑` o `X` rotar, `↓` soft drop, `Espacio` hard drop.
- `G` pieza fantasma (no se reinicia entre partidas), `S` cambia de skin.
- `P` o `Esc` pausa y reanuda. Emite `onPauseChange`.
- Menú: `↑` `↓` eligen modo, `Enter` o `Espacio` empiezan.
- En GAME OVER: `Espacio` reinicia el mismo modo (emite `onRestart`) y `M` vuelve al menú (emite `onRestart`).

Contrato del motor para los estados sin partida:

- Con el menú abierto, `end()` no hace nada y no emite `onGameOver`.
- `restart()` reinicia el modo actual. Si todavía no hay modo, no hace nada.
- `pause()` funciona en cualquier estado, dibuja `PAUSA` y bloquea el teclado del juego.

Registro:

```ts
// app/lib/games/registry.ts
export type GameDefinition = {
  factory: GameEngineFactory;
  width: number; // resolución interna del canvas
  height: number;
  controls: string; // línea bajo .crt-bottom
  initialLives: number; // vidas del HUD tras reiniciar
};
// ENGINES.asteroids = { ..., width: 800, height: 600, initialLives: 3 }
// ENGINES.tetris    = { createTetrisGame, 800, 600, initialLives: 1 }
```

Fila nueva en `games`:

```sql
insert into public.games (id, title, short, long, cat, cover, color, sort_order)
values ('tetris', 'TETRIS', '<frase corta>', '<descripción del juego real>', 'PUZZLE', 'cover-tetris', 'yellow', 10);
```

El texto de `short` y `long` debe describir el juego real: piezas, líneas, power-ups, desafíos y skins, sin prometer nada que no exista. El máximo actual de `sort_order` es 9 (`asteroids`).

---

## Plan de implementación

1. **Leer la documentación.** La guía de `node_modules/next/dist/docs/01-app` relevante para componentes cliente y `cacheComponents`, y el `game.js` de referencia. No genera código.
2. **Generalización.** `GameDefinition` en el registro; `GameCanvas` recibe `width`/`height` y calcula `aspectRatio`; `GamePlayer` usa `controls` e `initialLives`, y ya no hace el cast `as GameEngineFactory | undefined`. Comprobar que Asteroides se ve y juega igual.
3. **Constantes y utilidades.** `constants.ts` y `utils.ts` con piezas, rotación, colisión y velocidad como funciones puras que reciben el tablero por argumento.
4. **Skins.** `skins.ts` con las 4 paletas y su función de dibujo de bloque, y lectura y escritura de `tetris.skin` dentro de `try/catch`.
5. **Núcleo de reglas.** En `engine.ts`: tablero, pieza actual y siguiente, movimiento, rotación con kicks, fijado, limpieza de líneas, puntuación y nivel. Sin menú aún: arranca el modo Clásico.
6. **Bucle y entrada.** `requestAnimationFrame`, caída por `dropAccum`, teclado en `window` ignorando `input`, `textarea` y `button`, y `preventDefault` solo en teclas del juego.
7. **Dibujo.** Tablero, rejilla, pieza fantasma (alpha 0.2), pieza actual y panel lateral dentro del canvas de 800×600.
8. **Power-ups.** `powerups.ts` con los 5 efectos, el contador cada 5 líneas, el icono pulsante, el velo de Congelar y el aviso `flash`.
9. **Modos.** `challenges.ts` con los 5 desafíos, objetivo y progreso en el panel, y victoria con `finish(true)`.
10. **Menú en el canvas.** Pantalla con los 6 modos, navegación con `↑` `↓` y `Enter`, y `M` en GAME OVER.
11. **Ciclo de vida.** `start`, `pause`, `resume`, `restart`, `end` y `destroy`; `P` y `Esc`; un único `finish()`; `onGameOver` una vez; `onRestart`; reinicio con `Espacio` sin repetición.
12. **Registro y catálogo.** Entrada `tetris` en `ENGINES`; migración nueva en `supabase/migrations/` aplicada con `mcp__supabase__apply_migration`; portada `.cover-tetris` en `app/globals.css` con `/frontend-design`.
13. **Repaso.** `npm run lint`, `npx tsc --noEmit`, `npm run build`, partida completa guardada y comprobada en `/games/tetris`, `/hall-of-fame` y `/`, consola, `get_advisors`, retirada de código muerto.

---

## Criterios de aceptación

**Calidad**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] La consola no muestra errores ni avisos de React en `/games/tetris/play`.
- [ ] A 375 px de ancho no hay scroll horizontal y el canvas no se deforma.
- [ ] Asteroides conserva su canvas 800×600, su línea de controles y 3 corazones al empezar y al reiniciar.

**Catálogo**

- [ ] `/games` muestra 10 tarjetas y la de TETRIS tiene portada propia `.cover-tetris`, distinta de las demás.
- [ ] `/games/tetris` y `/games/tetris/play` responden 200.
- [ ] `games` contiene la fila `tetris` (`PUZZLE`, `yellow`, `sort_order` 10) y `list_migrations` lista la migración.
- [ ] La fila `caida` no cambia y sigue con simulación y sin botón de guardar.

**Juego**

- [ ] Al cargar aparece el canvas (no `.game-arena`) con el menú de 6 modos: Clásico, Sprint 40, Marea de basura, Bloques fijos, Piezas fantasma y Rotación inversa.
- [ ] `↑` `↓` mueven la selección y `Enter` o `Espacio` empiezan el modo elegido.
- [ ] Al empezar Clásico, ambos HUD muestran puntuación 0, un solo `♥` y nivel 01, y el tablero está vacío con 10 columnas y 20 filas.
- [ ] El primer `Espacio` sobre el tablero vacío suma exactamente 36 puntos (18 celdas × 2), sea cual sea la pieza.
- [ ] El primer `↓` sobre el tablero vacío suma exactamente 1 punto.
- [ ] Una línea simple suma 100 × nivel, doble 300 × nivel, triple 500 × nivel y Tetris (4 líneas) 800 × nivel. A nivel 2 un Tetris suma 1600.
- [ ] El nivel sube a 2 al limpiar 10 líneas, la caída pasa de 1000 ms a 910 ms, y desde el nivel 11 queda fija en 100 ms.
- [ ] `←` `→` mueven, `↑` y `X` rotan en sentido horario con los kicks `[0, -1, 1, -2, 2]`, y la pieza no atraviesa paredes ni bloques.
- [ ] `G` muestra y oculta la pieza fantasma, que se mantiene al empezar otra partida.
- [ ] Al limpiar 5 líneas, la siguiente pieza sale marcada con borde pulsante e icono, y el panel indica `Siguiente: <icono> <nombre>`. A las 10 líneas ocurre lo mismo.
- [ ] Bomba borra 3×3 alrededor del centro de la pieza, Rayo borra su fila y su columna, Tinte borra los bloques de su color tras 400 ms, Gravedad compacta cada columna y Congelar detiene la caída 5 s sin bloquear el movimiento.
- [ ] Los power-ups no suman puntos por sí mismos.
- [ ] Sprint 40 muestra `lines/40` y la cuenta atrás desde 2:00. Con 40 líneas el canvas muestra `¡DESAFÍO SUPERADO!`, y si se agota el tiempo muestra `GAME OVER` con el motivo `Se acabó el tiempo`.
- [ ] Marea de basura sube una fila gris con un hueco cada 10 s y se supera al sobrevivir 2:00.
- [ ] Bloques fijos empieza con grises en las 6 filas inferiores (cada fila con un hueco) y se supera al eliminarlos todos.
- [ ] Piezas fantasma oculta las piezas fijadas, salvo los grises, mientras dura la partida, y se supera con 20 líneas.
- [ ] Rotación inversa empieza en nivel 5 (HUD con `05`), rota en sentido antihorario desde el nivel 6 y se supera al llegar al nivel 8.
- [ ] `S` cambia entre Retro, Neon, Pastel y Pixel art al instante, el panel muestra el nombre, y tras recargar se conserva la skin elegida. Con `localStorage` bloqueado el juego sigue funcionando.
- [ ] Ambos HUD (canvas y HTML) muestran siempre los mismos `score`, `lives` y `level`.
- [ ] PAUSA congela el juego y el temporizador de los desafíos, y el botón pasa a REANUDAR. La tecla `P` y `Esc` hacen lo mismo. Al reanudar, `elapsed` no salta.
- [ ] Al terminar (victoria o derrota), el canvas muestra el título, la puntuación y el modal aparece con la misma puntuación, una sola vez.
- [ ] `Espacio` en GAME OVER reinicia el mismo modo con valores iniciales en ambos HUD y cierra el modal. Si `Espacio` seguía pulsado al morir (`e.repeat`), no reinicia hasta soltarlo y volver a pulsar.
- [ ] `M` en GAME OVER vuelve al menú, cierra el modal y deja el HUD en 0, un `♥` y nivel 01.
- [ ] FIN abre el modal con la puntuación actual y JUGAR DE NUEVO reinicia el mismo modo. FIN con el menú abierto no hace nada.
- [ ] Se puede escribir un nombre con espacios en el modal sin que `Espacio`, `G`, `S` ni `M` actúen en el juego.
- [ ] Salir y volver, y el doble montaje de StrictMode, no dejan dos bucles ni listeners duplicados: la pieza cae a un ritmo, no al doble.
- [ ] La línea de controles aparece en `/games/tetris/play` con las teclas de Tetris y no en juegos sin motor.

**Leaderboard**

- [ ] GUARDAR PUNTUACIÓN inserta en `scores` una fila con `game_id = 'tetris'`, el nombre y la puntuación del modal. Un doble clic crea una sola fila.
- [ ] Tras guardar, `/games/tetris` la muestra en `#01`, `Partidas` y `Mejor global` se actualizan, y aparece en `/hall-of-fame` y en la actividad de `/`.
- [ ] Un desafío superado también guarda con la misma puntuación de la partida, sin bonus.
- [ ] Una puntuación por encima de 9.999.999 se limita a 9.999.999 y no viola el `CHECK`.
- [ ] Los juegos sin motor siguen con simulación y sin botón de guardar.
- [ ] Tras las pruebas, `scores` no contiene filas de prueba.
- [ ] Una búsqueda de `service_role` en `app/` no da resultados.

---

## Decisiones

- **Sí:** id nuevo `tetris`, por decisión del usuario. **No:** reutilizar `caida`. Deja `caida` simulado como duplicado, igual que `rocas` y `asteroids` en SPEC 05.
- **Sí:** portar pieza fantasma, power-ups, skins y los 5 desafíos. **No:** récords locales, mejor combo, máximo de líneas y selector de nivel inicial. El ranking es `scores` y la plataforma ya cubre HUD, pausa y fin.
- **Sí:** un único canvas de 800×600 con el panel y el menú dibujados dentro. **No:** aspecto por juego, porque obligaría a cambiar `.crt-screen` y arriesga Asteroides.
- **Sí:** `lives = 1` jugando y `0` al terminar, y `level = startLevel + floor(lines / 10)`. Es la fórmula del original. En Rotación inversa el nivel inicial es 5, así que `GameStats.level` no empieza siempre en 1.
- **Sí:** `initialLives` en `GameDefinition`. **No:** dejar `LIVES = 3` fijo en `GamePlayer`, que mostraría tres corazones en Tetris.
- **Sí:** victoria y derrota terminan por el mismo `finish()` y `onGameOver`, con título `¡DESAFÍO SUPERADO!` o `GAME OVER`. **No:** solo guardar el modo Clásico. Obligaría a un flag nuevo en `GamePlayer`.
- **Sí:** los 6 modos comparten ranking. **No:** columna `mode` ni rankings separados (otra spec si hace falta).
- **Sí:** tecla `S` para la skin, guardada en `tetris.skin` dentro de `try/catch`. Es una preferencia de interfaz, no un récord. **No:** panel DOM de skins.
- **Sí:** `M` solo en GAME OVER. **No:** `M` desde la pausa, porque abandonaría una partida sin guardarla.
- **Sí:** reinicio con `Espacio` ignorando `e.repeat` y exigiendo soltar la tecla. Espacio también es el hard drop y, mantenido al morir, reiniciaría al instante.
- **Sí:** corregir el fallo documentado en el `CLAUDE.md` del original, donde el bucle seguía tras `endGame()`. Un solo camino `finish()` con indicador `gameOver` que detiene el bucle.
- **Sí:** conservar el aspecto y los controles del original, incluido el HUD y GAME OVER dibujados en el canvas, como en SPEC 05. **No:** sonido, que el original no tiene.

## Riesgos

| Riesgo                                                                                               | Mitigación                                                                                      |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| StrictMode duplica motores                                                                           | `destroy()` cancela `requestAnimationFrame` y quita todos los listeners; criterio de aceptación |
| Orden de eventos al reiniciar: si `onStats` llega antes que `onRestart`, el HUD vuelve a 3 corazones | `initialLives` en la definición, y el motor emite `onRestart` antes de `onStats`                |
| Alcance grande (906 líneas de original, 6 modos, 5 power-ups, 4 skins)                               | Plan en pasos pequeños, cada uno commiteable y con la app arrancando                            |
| `shadowBlur` de la skin Neon puede bajar el rendimiento                                              | Solo se aplica a los bloques de esa skin; se comprueba la fluidez en la verificación            |
| `localStorage` no disponible al leer o guardar la skin                                               | Todo acceso va en `try/catch` y la skin por defecto es Retro                                    |
| `end()` con el menú abierto emitiría una partida vacía con puntuación 0                              | `end()` no hace nada en el menú; criterio de aceptación                                         |
| Los 6 modos comparten ranking y no son comparables entre sí                                          | Decisión consciente; separar por modo queda para otra spec                                      |
| `elapsed` salta al reanudar tras una pausa larga                                                     | `lastTime` se reinicia en `resume()`; criterio de aceptación                                    |

---

## Qué **no** está en este spec

- Récords locales, combo y máximo de líneas.
- Selector de nivel inicial y menú de pausa propio.
- Ranking por modo de juego o columna `mode` en `scores`.
- Bonus de puntuación por superar un desafío.
- Controles táctiles y versión móvil.
- Sonido y música.
- Escalado por `devicePixelRatio`.
- Dar motor a `caida` o portar Arkanoid.
- Anti-trampas y tests automatizados.

Cada uno de esos puntos, si se aborda, va en su propia spec.
