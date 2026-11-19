# SPEC 09 — Juego Snake integrado con su leaderboard

> **Status:** Aprobado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 08
> **Date:** 2026-11-19
> **Objective:** Crear el juego Snake desde cero como motor TypeScript con su canvas, frutas pixel-art y controles de teclado, que notifica a React, y publicarlo como juego nuevo `snake` con su ranking en Supabase.

---

## Por qué existe este spec

Es el cuarto juego real tras Asteroides (SPEC 05), Tetris (SPEC 07) y Arkanoid (SPEC 08), y reutiliza el leaderboard genérico de SPEC 06. A diferencia de los anteriores no hay código de referencia: las reglas se definen aquí. Solo existe una hoja de sprites de frutas (`references/source-assets/snake-assets/fruits.png`, 3790×442) con su mapa de recortes `sprites.js`, que viene de _The Spriters Resource_ (Google Snake).

El usuario ha decidido crear un id nuevo `snake`, sin tocar `serpentina` (Snake simulado, `sort_order` 3), que queda como duplicado igual que `caida` tras SPEC 07. También ha elegido las reglas estilo Google Snake (las paredes matan), una fruta aleatoria que siempre vale 10 puntos y el aspecto neón de la plataforma con las frutas pixel-art. La generalización de `GameCanvas`, `GamePlayer` y `registry.ts` ya existe (SPEC 07), así que este spec no la repite.

**Aviso sobre `sprites.js`:** los rectángulos `{ x, y, w, h }` son correctos (se comprobaron recortando la fila), pero los **nombres están desplazados** respecto a las frutas reales (p. ej. `banana` recorta una manzana, `orange` recorta un plátano y `apple` una frambuesa). Por eso el motor usa los rects por índice y no importa los nombres del archivo. `sprites.js` tampoco se usa tal cual: depende de `window.SPRITE_ATLAS`, que el motor no puede tocar.

---

## Alcance

**Dentro:**

- Motor en `app/games/snake/` (TypeScript puro, sin React, sin estado global).
- Reglas: rejilla fija, serpiente que crece, una fruta a la vez, las paredes y el propio cuerpo matan, niveles por frutas comidas con velocidad creciente.
- Frutas dibujadas con los 22 sprites de la fila pixel-art de `fruits.png`.
- Serpiente neón dibujada con formas del canvas, con ojos que indican la dirección.
- Pantallas del canvas: inicio (`Pulsa una flecha para empezar`), `PAUSA`, `Game over` y `Has ganado` (rejilla llena).
- Entrada en `ENGINES` con la clave `snake`.
- Fila `snake` en `games` mediante una migración nueva y portada CSS `.cover-snake-fruit`, hecha con `/frontend-design`.
- Guardado en `scores` con `game_id = 'snake'`, tanto al perder como al ganar.

**Fuera de alcance (para otros specs):**

- Sonido (no hay assets y no se inventan).
- Controles táctiles y gestos de deslizar.
- Frutas con valores distintos, frutas especiales, power-ups, obstáculos y mapas con muros.
- Modos de juego (paredes que atraviesan, vidas, dos jugadores).
- Récords locales: el ranking es `scores`.
- Escalado por `devicePixelRatio`. La resolución interna es fija.
- Dar motor a `serpentina`, que sigue simulado.
- Anti-trampas en el guardado de puntuaciones.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

Constantes (`app/games/snake/constants.ts`), definidas en esta spec porque no hay original:

```ts
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
```

Convenciones:

- Coordenadas de celda: origen arriba a la izquierda, `x` de 0 a 19 y `y` de 0 a 14.
- La serpiente es un array de celdas `{ x, y }` con la cabeza en el índice 0.
- Intervalo de paso: `max(60, 140 - 8 × (level - 1))` ms. El nivel 1 va a 140 ms por paso y el nivel 11 (y siguientes) a 60 ms.
- Nivel: `level = 1 + floor(frutas / 5)`.

Reglas numéricas:

- Inicio: serpiente de 3 celdas en `(5,7)`, `(4,7)`, `(3,7)`, dirección derecha, puntuación 0, nivel 1.
- Fase `ready`: la serpiente no se mueve hasta la primera pulsación de dirección (que además fija su dirección, salvo `←`, que se ignora porque iría contra el cuerpo) o de `Espacio`.
- Cada paso mueve la cabeza una celda en la dirección actual. Si no se come, la cola se retira.
- Fruta comida: la serpiente crece una celda (no se retira la cola), `score += 10` y aparece otra fruta.
- Fruta nueva: en una celda libre al azar (no ocupada por la serpiente), con un sprite al azar distinto del anterior (índice 0 a 21).
- Muerte: la cabeza sale de la rejilla o entra en una celda del cuerpo. Moverse a la celda que deja libre la cola en ese mismo paso **no** mata.
- Entrada: máximo 2 giros en cola, un giro por paso. Se descarta el giro de 180° (contra el cuerpo) y el que repite la dirección. Así dos pulsaciones rápidas (`↑` y `←`) no hacen que la serpiente se muerda.
- Victoria: la serpiente ocupa las 300 celdas (no queda celda libre para la fruta). El máximo posible son 2.970 puntos, muy por debajo de 9.999.999 (`CHECK` de `scores`).
- `dt` en segundos con tope de 0,1 s y acumulador de tiempo: el paso lógico es de intervalo fijo, no atado al frame.

Fases: `ready` → `playing` → `gameover` o `won`.

Mapeo a `GameStats`:

- `score`: la puntuación (10 por fruta).
- `lives`: `1` mientras se juega y `0` en `gameover`. Si el jugador gana, conserva `1`. Es el mapeo del contrato para juegos sin vidas.
- `level`: el nivel real (`1 + floor(frutas / 5)`), sin tope visible.

Teclas:

- `←` `↑` `→` `↓` y `A` `W` `D` `S`: girar (en `ready`, la primera pulsación válida también arranca la partida).
- `Espacio`: arranca desde `ready` y reinicia en `gameover` y `won` (este último emite `onRestart`). Ignora `e.repeat`.
- `P`: pausa y reanuda. Emite `onPauseChange`.

Registro:

```ts
// app/lib/games/registry.ts
ENGINES.snake = {
  factory: createSnakeGame,
  width: 800,
  height: 600,
  controls: "← ↑ → ↓ / WASD MOVER · ESPACIO EMPEZAR/REINICIAR · P PAUSA",
  initialLives: 1,
};
```

Assets:

- `public/games/snake/fruits.png`, copia de `references/source-assets/snake-assets/fruits.png`.
- `app/games/snake/sprites.ts` con los rects de la fila pixel-art (`y = 136`, `h = 160`) por **índice** y en el orden real de la hoja:

| Índice | Fruta real | `x` | `w` |
| --- | --- | --- | --- |
| 0 | manzana | 34 | 110 |
| 1 | plátano | 186 | 150 |
| 2 | piña | 378 | 110 |
| 3 | uvas | 540 | 130 |
| 4 | calabaza | 712 | 130 |
| 5 | nabo | 894 | 110 |
| 6 | berenjena | 1066 | 110 |
| 7 | fresa | 1228 | 130 |
| 8 | cerezas | 1400 | 130 |
| 9 | zanahorias | 1582 | 110 |
| 10 | champiñón | 1734 | 150 |
| 11 | brócoli | 1906 | 150 |
| 12 | sandía | 2068 | 170 |
| 13 | pimiento verde | 2250 | 140 |
| 14 | kiwi | 2432 | 130 |
| 15 | limón | 2604 | 130 |
| 16 | naranja | 2786 | 110 |
| 17 | melocotón | 2948 | 130 |
| 18 | cacahuete | 3110 | 150 |
| 19 | frambuesa | 3302 | 110 |
| 20 | tomate | 3454 | 150 |
| 21 | cuenco de fruta | 3637 | 130 |

Los 22 rects salen de `sprites.js` en el mismo orden (el nombre de `sprites.js` del índice `i` no coincide con la fruta real). El orden real se comprobó con una tira de contacto de los recortes. El paso 2 del plan la vuelve a generar para confirmarlo antes de escribir `sprites.ts`.

Cada fruta se dibuja escalada a la celda (alto 36 px, ancho proporcional, centrada, con `imageSmoothingEnabled = false` para conservar el pixel-art).

Fila nueva en `games`:

```sql
insert into public.games (id, title, short, long, cat, cover, color, sort_order)
values ('snake', 'SNAKE', '<frase corta>', '<descripción del juego real>', 'ARCADE', 'cover-snake-fruit', 'yellow', 12);
```

El texto de `short` y `long` debe describir el juego real: serpiente que crece al comer frutas, las paredes y el propio cuerpo matan, y la velocidad sube cada 5 frutas. Sin prometer vidas, power-ups ni modos que no existen. El máximo actual de `sort_order` es 11 (`arkanoid`). El color `yellow` distingue la tarjeta de `serpentina` (`green`).

---

## Plan de implementación

1. **Leer la documentación.** La guía de `node_modules/next/dist/docs/01-app` relevante para componentes cliente, assets en `public/` y `cacheComponents`. No genera código.
2. **Assets y constantes.** Copiar `fruits.png` a `public/games/snake/`. Generar una tira de contacto con los 22 recortes y fijar el nombre real de cada índice. Crear `constants.ts` y `sprites.ts` (rects por índice, carga con `Image`, `drawFruit` que no hace nada hasta cargar). Manual: `npx tsc --noEmit` sin errores y la app sigue arrancando.
3. **Reglas puras.** `logic.ts` con funciones puras que reciben el estado por argumento: `step`, `canTurn`, `spawnFruit`, `stepInterval` y `levelFor`. Manual: `npx tsc --noEmit`.
4. **Núcleo del motor.** En `engine.ts`: estado en el cierre de `createSnakeGame`, `reset()`, fases, acumulador de tiempo, cola de giros, comer, crecer, puntuación, nivel, muerte y victoria. Sin teclado aún.
5. **Bucle y entrada.** `requestAnimationFrame` con `dt` limitado a 0,1 s, teclado en `window` ignorando `input`, `textarea` y `button`, `preventDefault` solo en flechas, `WASD`, `Espacio` y `P`. Manual: en `/games/snake/play` la serpiente se mueve y come.
6. **Dibujo.** Rejilla neón, serpiente con cabeza y ojos, fruta con sprite, HUD en el canvas (`Puntos`, `Nivel`) y pantallas `Pulsa una flecha para empezar`, `PAUSA`, `Game over` y `Has ganado`.
7. **Ciclo de vida.** `start`, `pause`, `resume`, `restart`, `end` y `destroy`; tecla `P`; `onStats` solo cuando cambia un valor; un único `finish()` con indicador `gameOver` que llama a `onGameOver` una vez (derrota, victoria y `end()`); `onRestart` al reiniciar con `Espacio` ignorando `e.repeat`.
8. **Registro y catálogo.** Entrada `snake` en `ENGINES`; migración nueva en `supabase/migrations/` aplicada con `mcp__supabase__apply_migration`; portada `.cover-snake-fruit` en `app/globals.css` con `/frontend-design`.
9. **Repaso.** `npm run lint`, `npx tsc --noEmit`, `npm run build`, partida completa guardada y comprobada en `/games/snake`, `/hall-of-fame` y `/`, consola, `get_advisors`, retirada de código muerto.

---

## Criterios de aceptación

**Calidad**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] La consola no muestra errores ni avisos de React en `/games/snake/play`.
- [ ] A 375 px de ancho no hay scroll horizontal y el canvas no se deforma.
- [ ] Asteroides, Tetris y Arkanoid conservan su canvas, su línea de controles y sus vidas iniciales (3, 1 y 3).

**Catálogo**

- [ ] `/games` muestra 12 tarjetas y la de SNAKE tiene portada propia `.cover-snake-fruit`, distinta de `.cover-snake` (la de `serpentina`) y de las demás.
- [ ] `/games/snake` y `/games/snake/play` responden 200.
- [ ] `games` contiene la fila `snake` (`ARCADE`, `yellow`, `sort_order` 12) y `list_migrations` lista la migración.
- [ ] La fila `serpentina` no cambia y sigue con simulación y sin botón de guardar.

**Juego**

- [ ] Al cargar aparece el canvas (no `.game-arena`) de 20×15 celdas con una serpiente de 3 celdas con la cabeza en `(5,7)`, una fruta con sprite y el texto `Pulsa una flecha para empezar`. La serpiente no se mueve hasta pulsar una tecla.
- [ ] Ambos HUD (canvas y HTML) muestran puntuación 0, un `♥` y nivel 01 al empezar.
- [ ] Las flechas y `WASD` giran la serpiente. En `ready`, `←` no la arranca.
- [ ] Comer una fruta suma exactamente 10 en ambos HUD y alarga la serpiente en una celda.
- [ ] La fruta nueva nunca aparece sobre la serpiente y su sprite es distinto del anterior.
- [ ] Pulsar el sentido contrario al de la marcha no hace nada. Dos giros rápidos seguidos (p. ej. `↑` y `←` yendo a la derecha) no provocan una muerte instantánea.
- [ ] Al comer 5 frutas el nivel pasa a 02 en ambos HUD y el paso baja de 140 a 132 ms. Con 50 frutas (nivel 11) el paso es 60 ms y no baja más.
- [ ] Chocar con una pared o con el propio cuerpo termina la partida: el canvas muestra `Game over` con la puntuación y el HUD pasa a 0 `♥`.
- [ ] Moverse a la celda que libera la cola en ese paso no mata.
- [ ] Llenar las 300 celdas muestra `Has ganado` y abre el modal con la misma puntuación.
- [ ] Ambos HUD muestran siempre los mismos `score`, `lives` y `level`.
- [ ] PAUSA congela la serpiente, el canvas muestra `PAUSA` y el botón pasa a REANUDAR. La tecla `P` hace lo mismo y emite el cambio de estado a React. Al reanudar no hay salto de movimiento.
- [ ] Al terminar (derrota o victoria), el canvas muestra el título y el modal aparece con la misma puntuación, una sola vez.
- [ ] `Espacio` en `Game over` o `Has ganado` reinicia con puntuación 0, un `♥` y nivel 01 en ambos HUD, y cierra el modal. Si la tecla seguía pulsada (`e.repeat`), no reinicia hasta soltarla y volver a pulsar.
- [ ] FIN abre el modal con la puntuación actual y JUGAR DE NUEVO reinicia.
- [ ] Se puede escribir un nombre con espacios en el modal sin que `Espacio` arranque o reinicie el juego ni `P` lo pause.
- [ ] Salir y volver, y el doble montaje de StrictMode, no dejan dos bucles ni listeners duplicados: la serpiente avanza a 140 ms por paso, no a 70.
- [ ] La línea de controles aparece en `/games/snake/play` con las teclas de Snake y no en juegos sin motor.

**Leaderboard**

- [ ] GUARDAR PUNTUACIÓN inserta en `scores` una fila con `game_id = 'snake'`, el nombre y la puntuación del modal. Un doble clic crea una sola fila.
- [ ] Tras guardar, `/games/snake` la muestra en `#01`, `Partidas` y `Mejor global` se actualizan, y aparece en `/hall-of-fame` y en la actividad de `/`.
- [ ] Los juegos sin motor siguen con simulación y sin botón de guardar.
- [ ] Tras las pruebas, `scores` no contiene filas de prueba.
- [ ] Una búsqueda de `service_role` en `app/` no da resultados.

---

## Decisiones

- **Sí:** id nuevo `snake`, por decisión del usuario. **No:** reutilizar `serpentina`, aunque era el equivalente claro. Queda `serpentina` simulado como duplicado, igual que `caida` tras SPEC 07 y `bloque-buster` tras SPEC 08.
- **Sí:** reglas estilo Google Snake: rejilla fija, las paredes matan, una fruta a la vez. **No:** paredes que atraviesan ni vidas, por decisión del usuario.
- **Sí:** `lives = 1` y `0` en `gameover`, con `initialLives: 1` en el registro, como Tetris. Es el mapeo del contrato para juegos sin vidas. **No:** inventar vidas.
- **Sí:** `level = 1 + floor(frutas / 5)` con velocidad creciente, para que `level` sea real y no un valor fijo. **No:** velocidad constante, que dejaría `level` sin sentido.
- **Sí:** fruta con sprite aleatorio y siempre 10 puntos, por decisión del usuario. **No:** valores distintos por fruta ni una fruta por nivel.
- **Sí:** rects de `sprites.js` por índice, con los nombres reales de la hoja. **No:** importar `sprites.js` ni usar sus nombres, que están desplazados y dependen de `window.SPRITE_ATLAS`.
- **Sí:** copiar `fruits.png` entero a `public/games/snake/` (585 KB) con rutas absolutas `/games/snake/fruits.png`. **No:** recortar la hoja a una sola fila ahora; se puede optimizar en otra spec si el peso molesta.
- **Sí:** aspecto neón de la plataforma con serpiente dibujada en el canvas y solo las frutas como sprites, por decisión del usuario. **No:** aspecto Google Snake.
- **Sí:** cola de 2 giros y descarte del giro de 180°, para que girar dos veces dentro de un mismo paso no haga morderse. **No:** aplicar cada pulsación directamente.
- **Sí:** paso lógico de intervalo fijo con acumulador de tiempo, independiente del frame. **No:** mover una celda por frame.
- **Sí:** victoria y derrota terminan por el mismo `finish()` y `onGameOver`, con título `Has ganado` o `Game over`. **No:** guardar solo la derrota.
- **Sí:** `Espacio` reinicia ignorando `e.repeat`; teclado en `window` ignorando `input`, `textarea` y `button`; `P` para pausar. Es el patrón de SPEC 05, 07 y 08.
- **Sí:** color `yellow` y portada propia `.cover-snake-fruit`. **No:** reutilizar `.cover-snake`, que sigue siendo la de `serpentina`.
- **Sí:** sin sonido. **No:** inventar audio sin assets.

## Riesgos

| Riesgo                                                     | Mitigación                                                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| StrictMode duplica motores                                 | `destroy()` cancela `requestAnimationFrame` y quita todos los listeners; criterio de aceptación       |
| Nombres de `sprites.js` desplazados                        | Se usan rects por índice y el paso 2 verifica visualmente cada recorte con una tira de contacto       |
| La imagen tarda en cargar y el primer frame sale sin fruta | `drawFruit` no hace nada hasta que la imagen carga; el bucle sigue sin errores                        |
| `destroy()` antes de que cargue la imagen                  | Indicador `destroyed` comprobado en el `onload`; no se dibuja ni se programa nada tras destruir       |
| Giros rápidos provocan muerte por 180°                     | Cola de 2 giros, un giro por paso, descarte de dirección opuesta y repetida                           |
| Tras pausar, el acumulador acumula tiempo                  | `lastTime` se reinicia en `resume()` y el acumulador se pone a 0; criterio de aceptación              |
| Elegir fruta libre con la rejilla casi llena               | Se elige entre las celdas libres calculadas, no por reintentos; sin celdas libres se declara victoria |
| `Espacio` pulsado en el modal arranca el juego             | El teclado ignora objetivos `input`, `textarea` y `button`; criterio de aceptación                    |
| `Espacio` mantenido al perder reinicia al instante         | Se ignora `e.repeat`; criterio de aceptación                                                          |
| Portada demasiado parecida a `.cover-snake`                | Color y composición distintos (amarillo y frutas); criterio de aceptación                             |

---

## Qué **no** está en este spec

- Sonido.
- Controles táctiles y gestos.
- Frutas con valores distintos, frutas especiales, power-ups y obstáculos.
- Modos alternativos (paredes que atraviesan, vidas, multijugador).
- Récords locales.
- Escalado por `devicePixelRatio`.
- Dar motor a `serpentina`.
- Anti-trampas y tests automatizados.

Cada uno de esos puntos, si se aborda, va en su propia spec.
