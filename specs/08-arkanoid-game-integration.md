# SPEC 08 — Juego Arkanoid integrado con su leaderboard

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-19
> **Objective:** Portar `references/started-games/04-arkanoid/` a un motor TypeScript con su canvas, sprites, sonido y controles de teclado, que notifica a React, y publicarlo como juego nuevo `arkanoid` con su ranking en Supabase.

---

## Por qué existe este spec

Es el tercer juego real tras Asteroides (SPEC 05) y Tetris (SPEC 07), y reutiliza el leaderboard genérico de SPEC 06. El original es un `game.js` de 302 líneas con estado global, un único canvas de 800×600, 5 niveles, una hoja de sprites y 2 sonidos. No tiene menús, skins ni récords locales, así que casi todo el original entra en el portado. Se reescribe como motor en TypeScript puro, sin estado global, para poder crear y destruir instancias (StrictMode monta dos veces).

El usuario ha decidido crear un id nuevo `arkanoid`, sin tocar el juego simulado `bloque-buster`, portar el sonido y el spritesheet, y controlar el juego solo con teclado. La generalización de `GameCanvas`, `GamePlayer` y `registry.ts` (`GameDefinition` con `width`, `height`, `controls` e `initialLives`) ya la hizo SPEC 07, por lo que este spec no la repite.

---

## Alcance

**Dentro:**

- Motor en `app/games/arkanoid/` (TypeScript puro, sin React, sin estado global).
- Reglas del original: pala, bola, rejilla de bloques, 5 niveles con velocidad creciente, bloques grises duros (2 golpes) desde el nivel 2, vidas con tope de 5 y +1 vida al completar un nivel.
- Hoja de sprites (`spritesheet-breakout.png`) para pala, bola, bloques y explosiones de 4 frames.
- Sonido: `ball-bounce.mp3` y `break-sound.mp3`.
- Pantallas del canvas: nivel completado, `Has ganado` y `Game over`, con sus textos originales.
- Entrada en `ENGINES` con la clave `arkanoid`.
- Fila `arkanoid` en `games` mediante una migración nueva y portada CSS `.cover-arkanoid`.
- Guardado en `scores` con `game_id = 'arkanoid'`, tanto al perder como al ganar.

**Fuera de alcance (para otros specs):**

- Control con ratón (`mousemove` y `click`). Solo teclado, por decisión del usuario.
- Controles táctiles y versión móvil.
- Power-ups, bolas múltiples y niveles nuevos (el original no los tiene).
- Menú de inicio y selector de nivel.
- Récords locales: el ranking es `scores`.
- Bonus de puntuación por ganar o por vidas sobrantes.
- Escalado por `devicePixelRatio`. La resolución interna es fija.
- Dar motor a `bloque-buster`, que sigue simulado.
- Anti-trampas en el guardado de puntuaciones.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

Constantes del original, sin cambios de valor (`app/games/arkanoid/constants.ts`):

```ts
export const W = 800;
export const H = 600;

export const CFG = {
  paddle: { w: 120, h: 14, y: 560, speed: 480 }, // speed en px/s
  ball: { size: 16 },
  block: { w: 64, h: 32, cols: 10, rows: 7, offsetX: 80, offsetY: 60 },
  lives: 3,
  maxLives: 5,
  pointsPerBlock: 10,
  pointsPerHardBlock: 20,
};

export const ROW_COLORS = [
  "red",
  "yellow",
  "cyan",
  "magenta",
  "hotpink",
  "green",
  "gray",
];
export const EXPLOSION_DURATION = 150; // ms, 4 frames
```

Los 5 niveles (`LEVELS`), con `name`, `ballSpeed`, `hardGray` y `mask(r, c)`:

| Nivel | Nombre   | `ballSpeed` (px/s) | `hardGray` | Máscara                                      |
| ----- | -------- | ------------------ | ---------- | -------------------------------------------- |
| 1     | Rejilla  | 320                | no         | todas las celdas (70 bloques)                |
| 2     | Pirámide | 350                | sí         | `abs(c - 4.5) <= 1 + r * 0.75`               |
| 3     | Tablero  | 380                | sí         | `(r + c) % 2 === 0`                          |
| 4     | Rombo    | 410                | sí         | `abs(c - 4.5) <= 1 + 1.2 * (3 - abs(r - 3))` |
| 5     | Franjas  | 440                | sí         | `r % 2 === 0`                                |

Reglas numéricas, sacadas de `game.js` (no del README, que está desactualizado):

- Bloque normal roto: +10. Bloque gris con `hardGray` (niveles 2 a 5): tiene `hp = 2`, el primer golpe solo rebota (sin puntos ni explosión) y el segundo suma +20. En el nivel 1 el gris es un bloque normal (+10).
- Lanzamiento: ángulo de 45° hacia arriba y a la derecha, con `vx = speed × cos(45°)` y `vy = -speed × sin(45°)`. La velocidad de la bola es constante dentro de cada nivel.
- Se rompe como máximo un bloque por frame, para no invertir la bola dos veces. El rebote invierte el eje de menor penetración y saca la bola del bloque.
- La pala solo rebota si la bola baja (`vy > 0`). El rebote es especular, sin efecto según el punto de impacto.
- Bola fuera por abajo (`y > H`): `lives--`. Con `lives <= 0` pasa a `gameover`, si no vuelve a `ready` con la bola pegada a la pala.
- Último bloque roto: fase `clearing` hasta que acaban las explosiones. Después, `levelclear` con `lives = min(5, lives + 1)`, o `won` si era el nivel 5.
- `dt` en segundos con tope de 1/30 s.
- Fases: `ready` → `playing` → `clearing` → `levelclear` → `won`, más `gameover`.

Resolución interna: **800×600**, un único canvas. El HUD del original (`Puntos`, `Nivel`, `Vidas`) se conserva dibujado en el canvas.

Mapeo a `GameStats`:

- `score`: la puntuación. El máximo posible queda muy por debajo de 9.999.999 (`CHECK` de `scores`), así que no hace falta limitarla.
- `lives`: las vidas reales (empiezan en 3, máximo 5). Al terminar con `gameover` vale `0`. Si el jugador gana, conserva las vidas que le quedan.
- `level`: el nivel real, de 1 a 5.

Teclas:

- `←` `→` mover la pala.
- `Espacio` lanzar la bola (fase `ready`).
- `Enter` o `Espacio` continuar en `levelclear` y reiniciar en `won` y `gameover` (este último emite `onRestart`).
- `P` pausa y reanuda. Emite `onPauseChange`.

Registro:

```ts
// app/lib/games/registry.ts
ENGINES.arkanoid = {
  factory: createArkanoidGame,
  width: 800,
  height: 600,
  controls: "← → MOVER · ESPACIO LANZAR · ENTER CONTINUAR · P PAUSA",
  initialLives: 3,
};
```

Assets (se copian de `references/started-games/04-arkanoid/assets/`):

- `public/games/arkanoid/spritesheet-breakout.png`
- `public/games/arkanoid/sounds/ball-bounce.mp3` (paredes, techo, pala y gris no roto)
- `public/games/arkanoid/sounds/break-sound.mp3` (bloque roto)

Los rects de los sprites (`SPRITES`, `EXPLOSION_FRAMES`) pasan a `app/games/arkanoid/sprites.ts` con los mismos valores que `assets/spritesheet.js`.

Fila nueva en `games`:

```sql
insert into public.games (id, title, short, long, cat, cover, color, sort_order)
values ('arkanoid', 'ARKANOID', '<frase corta>', '<descripción del juego real>', 'ARCADE', 'cover-arkanoid', 'magenta', 11);
```

El texto de `short` y `long` debe describir el juego real: pala, bola, bloques de colores, 5 niveles con velocidad creciente, bloques grises duros y vidas. Sin prometer power-ups ni nada que no exista. El máximo actual de `sort_order` es 10 (`tetris`). El color `magenta` distingue la tarjeta de `bloque-buster` (`cyan`).

---

## Plan de implementación

1. **Leer la documentación.** La guía de `node_modules/next/dist/docs/01-app` relevante para componentes cliente, assets en `public/` y `cacheComponents`, y el `game.js` de referencia. No genera código.
2. **Assets y constantes.** Copiar la hoja de sprites y los 2 sonidos a `public/games/arkanoid/`. Crear `constants.ts` (`W`, `H`, `CFG`, `ROW_COLORS`, `LEVELS`, `EXPLOSION_DURATION`) y `sprites.ts` (rects, carga de la imagen con `Image`, `drawSprite` y `drawFrame` que no hacen nada hasta cargar). Manual: `npx tsc --noEmit` sin errores y la app sigue arrancando.
3. **Utilidades y bloques.** `utils.ts` con `createBlocks(level)` y la colisión bola-bloque como funciones puras que reciben el estado por argumento. Manual: `npx tsc --noEmit`.
4. **Núcleo de reglas.** En `engine.ts`: estado en el cierre de `createArkanoidGame`, `reset()`, pala, bola pegada a la pala, lanzamiento, rebotes en paredes, techo y pala, colisión con bloques, puntuación, vidas, niveles y fases. Sin teclado aún.
5. **Bucle, entrada y sonido.** `requestAnimationFrame` con `dt` limitado a 1/30, teclado en `window` ignorando `input`, `textarea` y `button`, `preventDefault` solo en `←`, `→` y `Espacio`, y los 2 sonidos con clones de `Audio` que ignoran el rechazo de `play()`. Manual: en `/games/arkanoid/play` se mueve la pala y se lanza la bola.
6. **Dibujo.** Bloques, explosiones, pala y bola con los sprites, HUD del original y pantallas `Nivel N completado`, `Has ganado` y `Game over`. Manual: se ven los 5 niveles al avanzar.
7. **Ciclo de vida.** `start`, `pause`, `resume`, `restart`, `end` y `destroy`; tecla `P` con `PAUSA` dibujado en el canvas; `onStats` solo cuando cambia un valor; un único `finish()` con indicador `gameOver` que llama a `onGameOver` una vez (derrota, victoria y `end()`); `onRestart` al reiniciar con `Enter` o `Espacio` ignorando `e.repeat`.
8. **Registro y catálogo.** Entrada `arkanoid` en `ENGINES`; migración nueva en `supabase/migrations/` aplicada con `mcp__supabase__apply_migration`; portada `.cover-arkanoid` en `app/globals.css` con `/frontend-design`.
9. **Repaso.** `npm run lint`, `npx tsc --noEmit`, `npm run build`, partida completa guardada y comprobada en `/games/arkanoid`, `/hall-of-fame` y `/`, consola, `get_advisors`, retirada de código muerto.

---

## Criterios de aceptación

**Calidad**

- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [x] La consola no muestra errores ni avisos de React en `/games/arkanoid/play`.
- [x] A 375 px de ancho no hay scroll horizontal y el canvas no se deforma.
- [x] Asteroides y Tetris conservan su canvas, su línea de controles y sus vidas iniciales (3 y 1).

**Catálogo**

- [x] `/games` muestra 11 tarjetas y la de ARKANOID tiene portada propia `.cover-arkanoid`, distinta de `.cover-bricks` y de las demás.
- [x] `/games/arkanoid` y `/games/arkanoid/play` responden 200.
- [x] `games` contiene la fila `arkanoid` (`ARCADE`, `magenta`, `sort_order` 11) y `list_migrations` lista la migración.
- [x] La fila `bloque-buster` no cambia y sigue con simulación y sin botón de guardar.

**Juego**

- [x] Al cargar aparece el canvas (no `.game-arena`) con 70 bloques en 7 filas de 10 columnas (rojo, amarillo, cian, magenta, rosa, verde y gris), la pala centrada en `x = 340` y la bola pegada a ella.
- [x] Ambos HUD (canvas y HTML) muestran puntuación 0, tres `♥` y nivel 01 al empezar.
- [x] `←` y `→` mueven la pala a 480 px/s y no la sacan del canvas (`0 ≤ x ≤ 680`).
- [x] Con la bola pegada, la pala la arrastra. `Espacio` la lanza a 45° hacia arriba y a la derecha, a 320 px/s en el nivel 1.
- [x] Romper un bloque normal suma exactamente 10 en ambos HUD, con explosión de 4 frames en 150 ms y sonido de rotura.
- [x] En el nivel 1 un bloque gris se rompe de un golpe y suma 10.
- [x] En los niveles 2 a 5 un bloque gris resiste el primer golpe (rebota con sonido de rebote, sin puntos ni explosión) y al segundo suma exactamente 20.
- [x] La bola rebota en paredes, techo y pala con sonido de rebote, e invierte solo el eje de menor penetración contra un bloque. Nunca rompe dos bloques en el mismo frame.
- [s] La pala solo rebota la bola cuando esta baja.
- [s] Dejar caer la bola resta una vida en ambos HUD y devuelve la bola a la pala. Con la tercera caída seguida en el nivel 1 aparece `Game over`.
- [s] Al romper el último bloque, el canvas espera a que terminen las explosiones y muestra `Nivel N completado` con `Pulsa Enter o Espacio para continuar`. Las vidas suben en 1 (máximo 5) en ambos HUD.
- [s] `Enter` o `Espacio` en `levelclear` cargan el nivel siguiente, con su máscara y su velocidad (350, 380, 410 y 440 px/s) y el nivel sube en ambos HUD.
- [s] Al completar el nivel 5, el canvas muestra `Has ganado` y el modal aparece con la misma puntuación, conservando las vidas restantes.
- [s] Ambos HUD muestran siempre los mismos `score`, `lives` y `level`.
- [s] PAUSA congela el juego (bola, explosiones y pala), el canvas muestra `PAUSA` y el botón pasa a REANUDAR. La tecla `P` hace lo mismo y emite el cambio de estado a React.
- [s] Al terminar (derrota o victoria), el canvas muestra el título y el modal aparece con la misma puntuación, una sola vez.
- [s] `Enter` o `Espacio` en `Game over` o `Has ganado` reinicia con puntuación 0, tres `♥` y nivel 01 en ambos HUD, y cierra el modal. Si la tecla seguía pulsada (`e.repeat`), no reinicia hasta soltarla y volver a pulsar.
- [x] FIN abre el modal con la puntuación actual y JUGAR DE NUEVO reinicia.
- [x] Se puede escribir un nombre con espacios en el modal sin que `Espacio` lance la bola ni `P` pause el juego.
- [x] Salir y volver, y el doble montaje de StrictMode, no dejan dos bucles ni listeners duplicados: la bola se mueve a su velocidad, no al doble.
- [x] Si el navegador bloquea el audio, el juego sigue funcionando sin errores en consola.
- [x] La línea de controles aparece en `/games/arkanoid/play` con las teclas de Arkanoid y no en juegos sin motor.

**Leaderboard**

- [x] GUARDAR PUNTUACIÓN inserta en `scores` una fila con `game_id = 'arkanoid'`, el nombre y la puntuación del modal. Un doble clic crea una sola fila.
- [x] Tras guardar, `/games/arkanoid` la muestra en `#01`, `Partidas` y `Mejor global` se actualizan, y aparece en `/hall-of-fame` y en la actividad de `/`.
- [x] Una partida ganada también guarda con la puntuación de la partida, sin bonus.
- [x] Los juegos sin motor siguen con simulación y sin botón de guardar.
- [x] Tras las pruebas, `scores` no contiene filas de prueba.
- [x] Una búsqueda de `service_role` en `app/` no da resultados.

---

## Decisiones

- **Sí:** id nuevo `arkanoid`, por decisión del usuario. **No:** reutilizar `bloque-buster`. Deja `bloque-buster` simulado como duplicado, igual que `caida` tras SPEC 07.
- **Sí:** color `magenta` y portada propia `.cover-arkanoid`. **No:** reutilizar `cover-bricks`, que haría las dos tarjetas casi iguales.
- **Sí:** portar el sonido (2 mp3) y la hoja de sprites con explosiones, para conservar el aspecto y la sensación del original, como en SPEC 05 y 07. **No:** redibujar con formas del canvas.
- **Sí:** solo teclado (`←` `→`, `Espacio`, `Enter`, `P`), por decisión del usuario. **No:** ratón ni táctil, que el original sí tenía (`mousemove` y `click`). Queda para otra spec.
- **Sí:** `lives` y `level` reales (3 vidas, tope 5, niveles 1 a 5), `lives = 0` solo en `gameover`. Es el mapeo del contrato para juegos con vidas y niveles propios. **No:** forzar `lives = 1`.
- **Sí:** victoria y derrota terminan por el mismo `finish()` y `onGameOver`, con título `Has ganado` o `Game over`. **No:** guardar solo la derrota, que obligaría a un flag nuevo en `GamePlayer`.
- **Sí:** conservar el HUD, `levelclear`, `Has ganado` y `Game over` dibujados en el canvas, como en SPEC 05. La plataforma suma su HUD HTML.
- **Sí:** reinicio con `Enter` o `Espacio` ignorando `e.repeat`. `Espacio` también lanza la bola, y mantenerlo al perder reiniciaría al instante.
- **Sí:** teclado en `window` ignorando `input`, `textarea` y `button`, algo que el original no hacía. Hace falta para escribir el nombre en el modal. Es una corrección al portar.
- **Sí:** `P` para pausar, que el original no tiene. La pausa dibuja `PAUSA` en el canvas y emite `onPauseChange`.
- **Sí:** sprites y sonidos en `public/games/arkanoid/` con rutas absolutas `/games/arkanoid/...`. **No:** rutas relativas a `references/`.
- **Sí:** los textos de `games` describen solo lo que existe. **No:** prometer power-ups ni bolas múltiples.

## Riesgos

| Riesgo                                                         | Mitigación                                                                                         |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| StrictMode duplica motores                                     | `destroy()` cancela `requestAnimationFrame` y quita todos los listeners; criterio de aceptación    |
| La imagen tarda en cargar y el primer frame sale vacío         | `drawSprite` y `drawFrame` no hacen nada hasta que la imagen carga; el bucle sigue sin errores     |
| `destroy()` antes de que cargue la imagen                      | Indicador `destroyed` comprobado en el `onload`; no se dibuja ni se programa nada tras destruir    |
| Los navegadores bloquean `play()` sin gesto previo             | `play()` se llama dentro de `.catch(() => {})`; el primer sonido llega tras `Espacio` (un gesto)   |
| Orden de eventos al reiniciar: `onStats` antes que `onRestart` | `initialLives = 3` en la definición, y el motor emite `onRestart` antes de `onStats`               |
| Túnel de la bola a velocidad alta con `dt` grande              | `dt` limitado a 1/30 s: con 440 px/s la bola avanza como máximo ≈ 14,7 px por frame (bloque 32 px) |
| Tras pausar, `dt` salta al reanudar                            | `lastTime` se reinicia en `resume()`; criterio de aceptación                                       |
| `Espacio` pulsado en el modal lanza la bola                    | El teclado ignora objetivos `input`, `textarea` y `button`; criterio de aceptación                 |
| Portada demasiado parecida a `.cover-bricks`                   | Color y composición distintos; criterio de aceptación                                              |

---

## Qué **no** está en este spec

- Control con ratón y controles táctiles.
- Power-ups, bolas múltiples, niveles nuevos y efecto de ángulo según el punto de impacto en la pala.
- Menú de inicio y selector de nivel.
- Récords locales.
- Bonus de puntuación por ganar o por vidas restantes.
- Escalado por `devicePixelRatio`.
- Dar motor a `bloque-buster`.
- Anti-trampas y tests automatizados.

Cada uno de esos puntos, si se aborda, va en su propia spec.
