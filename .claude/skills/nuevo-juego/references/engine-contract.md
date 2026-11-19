# Contrato del motor y cómo portar un juego

Referencia completa: `app/lib/games/types.ts` y `app/games/asteroids/engine.ts` (el motor de ejemplo, ~475 líneas). Léelos antes de escribir un motor nuevo.

## Contrato

```ts
type GameStats = { score: number; lives: number; level: number }; // lives 0 al terminar; level empieza en 1

type GameEngineEvents = {
  onStats: (s: GameStats) => void;        // solo cuando cambia algún valor (+ al iniciar/reiniciar)
  onGameOver: (final: GameStats) => void; // una vez por partida
  onRestart: () => void;                  // el jugador reinició DENTRO del juego (Espacio)
  onPauseChange?: (paused: boolean) => void; // solo tecla P; no con pause()/resume()
};

interface GameEngine {
  start(): void;   // partida nueva y arranca el bucle
  pause(): void;
  resume(): void;
  restart(): void; // partida nueva; no emite onRestart
  end(): void;     // muestra GAME OVER en el canvas y emite onGameOver
  destroy(): void; // detiene el bucle y quita TODOS los listeners
}

type GameEngineFactory = (canvas: HTMLCanvasElement, events: GameEngineEvents) => GameEngine;
```

## Estructura de archivos

```
app/games/<id>/
  constants.ts   # W, H y todas las constantes del original, sin cambios de valor
  utils.ts       # helpers puros
  entities.ts    # clases/objetos con update(dt) y draw(ctx) (ctx por argumento, nunca global)
  engine.ts      # export function createXGame(canvas, events): GameEngine
```

Si el juego es pequeño (Arkanoid ≈ 300 líneas) puede bastar `constants.ts` + `engine.ts`. No fragmentes por fragmentar.

## Portar desde un `game.js` de references

1. **Globales → cierre.** Cada `let score, lives, ...` pasa a variables dentro de `createXGame`. Una función `reset()` las reinicia (la usan `start` y `restart`).
2. **`ctx` por argumento.** `canvas.getContext("2d")` una vez en la fábrica y se pasa a los `draw`.
3. **Bucle.** `requestAnimationFrame` con `dt` en segundos limitado (Asteroides: 0.05 s). Guarda el id para cancelarlo. Si el original usa acumuladores de tiempo (Tetris), consérvalos.
4. **Teclado.** Un `keydown`/`keyup` en `window` añadido en la fábrica y quitado en `destroy()`. Primero: `if (target is input|textarea|button) return`. `preventDefault` solo para las teclas del juego. Añade `P` para pausa si el original no la tiene.
5. **HUD y GAME OVER del canvas se conservan** (decisión de SPEC 05): el juego mantiene su aspecto; la plataforma suma su HUD HTML. El texto "ESPACIO PARA REINICIAR" sigue y, al usarse, emite `onRestart`.
6. **Pausa dibuja `PAUSA` en el canvas**; la plataforma oculta su overlay HTML `EN PAUSA` cuando hay motor.
7. **Fin de partida.** Un único camino `finish()` con indicador `gameOver`: dibuja el overlay, para el bucle de lógica y llama `onGameOver` una vez. Lo usan tanto la condición del juego como `end()`.
8. **Assets.** Imágenes/sonidos van a `public/games/<id>/` y se cargan con rutas `/games/<id>/...`. Si hay sonido, respeta que los navegadores exigen un gesto previo para reproducir. Si la spec deja el sonido fuera, no lo portes.
9. **Dibuja todo en un solo canvas** (el panel "siguiente" o la puntuación van dentro del área de dibujo).
10. **Correcciones del original**: si `game.js` o su `CLAUDE.md` documentan un fallo conocido (p. ej. Tetris sigue en `requestAnimationFrame` tras `endGame()`), corrígelo en el portado y anótalo en Decisiones de la spec.

## Alcance: el original puede ser mucho más que el juego

Los `game.js` de references no son todos pequeños (Asteroides 587 líneas, Tetris 906, Arkanoid 302). Suelen mezclar el juego con UI propia: menú de modos, desafíos, skins, selector de nivel, récords en `localStorage`, paneles DOM y varios canvas. La plataforma ya aporta HUD, pausa, fin de partida, modal y ranking, así que esa capa se duplica o choca. Haz un inventario y propón en la spec qué entra (el juego base: reglas, puntuación, teclas) y qué queda fuera (menús, récords locales, extras), con la justificación. Si hay duda sobre un extra, pregúntalo en la fase 2. Los récords en `localStorage` nunca se portan: el ranking es `scores`.

## Cifras exactas para los criterios

Saca las cifras de la spec del código, no de memoria ni del README (que suele estar desactualizado, como el de Arkanoid): tabla de puntos, fórmulas de velocidad por nivel, tamaños. Apunta también el orden de los cálculos (p. ej. si la puntuación usa el nivel antes o después de recalcularlo) porque cambia el resultado.

## Conflicto de teclas con el reinicio

Si una tecla del juego es la misma que reinicia en GAME OVER (Espacio es el hard drop de Tetris), mantenerla pulsada al morir reiniciaría al instante. Ignora `e.repeat` en el reinicio y/o exige soltar la tecla antes de aceptarla, y añade un criterio de aceptación.

## Mapeo de `lives` y `level`

`GameStats` exige ambos porque el HUD de la plataforma los muestra. Si el juego no los tiene, decide con el usuario y deja la decisión escrita en la spec:

- Sin vidas (Tetris, Serpentina): `lives = 1` mientras se juega y `0` al terminar.
- Sin niveles: `level = 1` fijo, o el nivel derivado de la dificultad (Tetris: nivel por líneas).
- Con más vidas que 3 o niveles propios (Arkanoid): se usan los reales.

## Unidades y puntuación

- La puntuación debe ser un entero entre 0 y 9.999.999: es el `CHECK` de `scores`. Si el juego puede superarlo, limita en el motor.
- Documenta en la spec las puntuaciones exactas (p. ej. "una línea simple = 100 × nivel") para convertirlas en criterios verificables.
