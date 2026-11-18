# SPEC 05 — Juego Asteroides integrado en la plataforma

> **Status:** Implementado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-11-18
> **Objective:** Portar a TypeScript el juego `references/started-games/02-asteroids/` como un motor que conserva su propio canvas, HUD y controles, y que además notifica a React (puntuación, vidas, nivel, fin y reinicio) y puede ser pausado o terminado desde React, añadiéndolo al catálogo como un juego nuevo `asteroids`.

---

## Por qué existe este spec

Hasta ahora `GamePlayer` simula la partida: suma puntos aleatorios con un `setInterval` y dibuja un escenario falso. Este es el primer juego real. Fija el patrón que seguirán Tetris y Arkanoid: un **motor** en TypeScript puro, sin React, que dibuja en un canvas, se controla con su propio teclado y avisa por callbacks, y un componente de React que lo monta, lo observa y lo pausa o termina.

El juego original es un `game.js` de unos 600 líneas con estado global, un HUD dibujado en el canvas y un "ESPACIO PARA REINICIAR" propio. Se porta a módulos y se quita el estado global, pero el juego conserva su aspecto y comportamiento: canvas, HUD, controles y pantalla de GAME OVER. React no sustituye nada de eso: se suma. La plataforma muestra además su propio HUD HTML y el modal para guardar la puntuación, alimentados por las notificaciones del motor.

---

## Alcance

**Dentro:**

- Motor del juego en `app/games/asteroids/`, sin dependencias de React, con la lógica de `game.js`: nave, balas, asteroides de tres tamaños, partículas, niveles, 3 vidas, power-up Disparo Triple y Escudo Temporal.
- Contrato común de motores en `app/lib/games/types.ts` (`GameEngine`, `GameStats`, `GameEngineEvents`).
- Registro de motores por id de juego en `app/lib/games/registry.ts` (hoy solo `asteroids`).
- Componente `app/components/GameCanvas.tsx` (`"use client"`) que monta el motor en un `<canvas>` de 800×600 de resolución interna, escalado al ancho disponible, y lo destruye al desmontar.
- Integración en `app/components/GamePlayer.tsx`: si el id del juego tiene motor, se usa el canvas real en lugar del escenario y la puntuación simulada. Los otros 8 juegos siguen como están.
- Se mantienen los dos HUD: el del juego dibujado en el canvas (`SCORE`, `NIVEL`, vidas, `TRIPLE`, `ESCUDO`) y el HUD HTML de la plataforma, que muestra puntuación, vidas y nivel reales recibidos del motor.
- Se mantienen los controles y la pantalla de fin del juego: teclado propio y overlay `GAME OVER` con `ESPACIO PARA REINICIAR`. El motor notifica a React el reinicio para que el modal se cierre y el HUD HTML se ponga a cero.
- Los botones de la plataforma PAUSA, FIN y JUGAR DE NUEVO controlan el motor, y al terminar la partida sale el modal existente para guardar la puntuación.
- Nueva entrada `asteroids` en `app/data/games.ts` y nueva clase `.cover-asteroids` en `app/globals.css`.
- Línea de controles bajo la pantalla CRT solo para los juegos con motor.
- La puntuación se guarda en `localStorage` (`av_scores`), como hoy.

**Fuera de alcance (para otros specs):**

- Guardar puntuaciones en Supabase, tabla `scores` y RLS.
- Que el Salón de la Fama lea `av_scores` o muestre las partidas reales. Sigue con datos ficticios.
- Controles táctiles y versión móvil del juego.
- Sonido y música (el original no tiene).
- Nuevos elementos de juego que el README original menciona y `game.js` no implementa: OVNIs y asteroide "estrella fugaz".
- Escalado por `devicePixelRatio` (nitidez en pantallas retina). Se mantiene la resolución fija 800×600 del original.
- Portar Tetris y Arkanoid (`references/started-games/03-tetris`, `04-arkanoid`).
- Modificar o retirar el juego `rocas` y su simulación.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

Contrato común entre cualquier motor y React:

```ts
// app/lib/games/types.ts
export type GameStats = {
  score: number;
  lives: number; // 0 al terminar
  level: number; // empieza en 1
};

export type GameEngineEvents = {
  onStats: (stats: GameStats) => void; // solo cuando cambia algún valor
  onGameOver: (finalStats: GameStats) => void; // una vez por partida
  onRestart: () => void; // el jugador reinició desde el propio juego (Espacio)
  onPauseChange?: (paused: boolean) => void; // el jugador pausó o reanudó con la tecla P (no se emite con pause()/resume())
};

export interface GameEngine {
  start(): void; // empieza una partida nueva y arranca el bucle
  pause(): void;
  resume(): void;
  restart(): void; // partida nueva desde cero (no emite onRestart; solo lo emite el reinicio con Espacio)
  end(): void; // termina la partida actual: muestra GAME OVER en el canvas y emite onGameOver
  destroy(): void; // detiene el bucle y quita todos los listeners
}

export type GameEngineFactory = (
  canvas: HTMLCanvasElement,
  events: GameEngineEvents,
) => GameEngine;
```

Registro y entrada de catálogo:

```ts
// app/lib/games/registry.ts
export const ENGINES: Record<string, GameEngineFactory> = {
  asteroids: createAsteroidsGame,
};

// app/data/games.ts (nueva entrada, tipo Game existente)
{ id: "asteroids", title: "ASTEROIDES", cat: "SHOOTER",
  cover: "cover-asteroids", color: "cyan", best: 0, plays: "0", /* short, long */ }
```

Convenciones:

- Resolución interna fija: 800×600 (`W`, `H` en `app/games/asteroids/constants.ts`). El canvas se escala con CSS (`width: 100%`, `aspect-ratio: 4 / 3`).
- Unidades como en el original: tiempo en segundos, velocidades en px/s, `dt` limitado a 0.05 s.
- Constantes del original sin cambios: `RADII = [0, 16, 30, 50]`, `SPEEDS = [0, 85, 55, 32]`, `POINTS = [0, 100, 50, 20]`, `TRIPLE_DURATION = 10`, `SHIELD_DURATION = 5`.
- Sin estado global: todo el estado vive en el cierre de `createAsteroidsGame`. Se pueden crear y destruir varias instancias.
- El motor no emite `onStats` en cada frame, solo cuando cambian `score`, `lives` o `level`.
- El HUD del canvas se porta sin cambios: `SCORE`, `NIVEL`, iconos de vidas, `TRIPLE Ns`, `ESCUDO` y el overlay `GAME OVER` con `PUNTAJE` y `ESPACIO PARA REINICIAR`.
- Teclas del original: `←` `→` rotar, `↑` propulsar, `Espacio` disparar (y reiniciar en GAME OVER), `↓` escudo. Se añade `P` para pausar. El motor ignora eventos de teclado cuyo objetivo sea `input`, `textarea` o `button`.
- La tecla `P` la gestiona el motor y avisa a React con `onPauseChange`, para que el botón PAUSA/REANUDAR y el `paused` de `GamePlayer` sigan sincronizados. `pause()` y `resume()` llamados desde React no emiten `onPauseChange`.
- Al terminar la partida el canvas muestra `GAME OVER`, el motor emite `onGameOver` y React abre el modal. Si se reinicia con `Espacio`, el motor emite `onRestart` y React cierra el modal.

---

## Plan de implementación

Cada paso deja la app arrancando con `npm run dev` y es commiteable por separado.

1. **Leer la documentación.** Revisar en `node_modules/next/dist/docs/01-app` lo que afecta a este spec: Client Components, efectos con `<canvas>` y limpieza bajo `cacheComponents` (y `StrictMode`, que monta dos veces en desarrollo), y estilos globales. Releer `references/started-games/02-asteroids/game.js` y su `CLAUDE.md`. Ajustar los pasos siguientes si algo contradice este plan. No genera código.
2. **Contrato y constantes.** Crear `app/lib/games/types.ts`, `app/games/asteroids/constants.ts` (`W`, `H`, tablas y tiempos del original) y `app/games/asteroids/utils.ts` (`wrap`, `dist`, `rand`, `randInt`). Verificar con `npx tsc --noEmit`.
3. **Entidades simples.** Crear `app/games/asteroids/entities.ts` con `Bullet`, `Asteroid` (con `split()`), `Particle` y `PowerUp`. Cada `draw` recibe el `CanvasRenderingContext2D` como argumento en lugar de usar un global. Verificar con `npx tsc --noEmit`.
4. **Nave.** Añadir `Ship` a `entities.ts`. `update` recibe el estado de teclas, `tryShoot` recibe si el disparo triple está activo, y `draw`/`drawShield` reciben el contexto y el temporizador del escudo. Verificar con `npx tsc --noEmit`.
5. **Motor: bucle, entrada y colisiones.** Crear `app/games/asteroids/engine.ts` con `createAsteroidsGame`: `requestAnimationFrame`, `dt` limitado, listeners de teclado en `window` (con `e.preventDefault()` solo para las 5 teclas del juego), nave, balas, asteroides, partículas, colisiones circulares y puntuación. Todavía sin power-ups ni escudo.
6. **Motor: niveles y vidas.** Añadir al motor las 3 vidas, la muerte con reaparición a los 2 s y la invencibilidad, y `nextLevel()` con `3 + level` asteroides grandes a más de `SAFE_DIST` del centro. Emitir `onStats` al cambiar `score`, `lives` o `level`. Portar el HUD del canvas (`drawHUD`, iconos de vidas) tal cual.
7. **Motor: power-ups y escudo.** Añadir Disparo Triple (una vez por nivel en una destrucción aleatoria) y Escudo Temporal (uno por vida, tecla `↓`), con sus indicadores en el canvas.
8. **Motor: ciclo de vida.** Implementar `start`, `pause` (tecla `P` incluida), `resume`, `restart`, `end` y `destroy`. Al llegar a 0 vidas o llamar a `end()`, mostrar el overlay `GAME OVER` del canvas y emitir `onGameOver` una sola vez. En GAME OVER, `Espacio` reinicia la partida como en el original y emite `onRestart`. Mantener un `pause` con un texto `PAUSA` en el canvas. La tecla `P` alterna la pausa y emite `onPauseChange`. Crear `app/lib/games/registry.ts`.
9. **Componente de canvas.** Crear `app/components/GameCanvas.tsx`. Crea el motor en `useEffect`, lo destruye en el cleanup y expone `end()` por `ref`. Props: `factory`, `paused`, `runId` (al cambiar, llama a `restart()`), `onStats`, `onGameOver`, `onRestart`, `onPauseChange` (opcional). Los callbacks se guardan en refs para que cambiar de `GamePlayer` no recree el motor.
10. **Catálogo y portada.** Añadir la entrada `asteroids` a `app/data/games.ts` (al final del array, con `short` y `long` acordes al juego real: disparo triple, escudo y 3 vidas, sin OVNIs). Añadir `.cover-asteroids` a `app/globals.css` siguiendo el estilo de `.cover-rocas` (nave triangular y rocas poligonales dibujadas con CSS). Con `npm run dev`, `/games` muestra 9 tarjetas y `/games/asteroids` carga.
11. **Integrar en `GamePlayer`.** En `app/components/GamePlayer.tsx`, si `ENGINES[game.id]` existe: no arrancar el `setInterval`, renderizar `GameCanvas` dentro de `.crt-screen` en lugar de `.game-arena`, y tomar `score`, `lives` y `level` de `onStats` para el HUD HTML. PAUSA alterna `paused` (y `onPauseChange` lo mantiene sincronizado cuando se pausa con `P`), FIN llama a `end()`, `onGameOver` abre el modal con la puntuación final, `onRestart` cierra el modal y pone el HUD HTML a cero, y JUGAR DE NUEVO incrementa `runId`. Con motor, no se muestra el overlay HTML `EN PAUSA` (el canvas ya dibuja `PAUSA`). Quitar el foco de los botones tras pulsarlos para que `Espacio` no los reactive. Los juegos sin motor siguen exactamente igual.
12. **Línea de controles y repaso.** Mostrar bajo `.crt-bottom` la línea `← → ROTAR · ↑ PROPULSAR · ESPACIO DISPARAR · ↓ ESCUDO · P PAUSA` solo si el juego tiene motor. Ejecutar `npm run lint`, `npm run build`, jugar una partida completa en el navegador, comprobar la consola y retirar código muerto.

---

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores.
- [ ] `npx tsc --noEmit` termina sin errores.
- [ ] `npm run build` termina sin errores.
- [ ] `/games` muestra 9 tarjetas, y la tarjeta ASTEROIDES tiene portada propia distinta de la de ROCAS.
- [ ] `/games/asteroids` y `/games/asteroids/play` responden 200.
- [ ] En `/games/asteroids/play` aparece el canvas con la nave en el centro y 4 asteroides grandes, y no aparece el escenario falso (`.game-arena`).
- [ ] El canvas dibuja su propio HUD (`SCORE`, `NIVEL`, iconos de vidas) y la plataforma muestra además el suyo en HTML.
- [ ] La puntuación de ambos HUD empieza en 0 y no cambia mientras no se destruya ningún asteroide.
- [ ] Destruir un asteroide grande suma exactamente 20 en ambos HUD, uno mediano 50 y uno pequeño 100.
- [ ] Ambos HUD muestran siempre los mismos valores de puntuación, vidas y nivel.
- [ ] `←` y `→` rotan la nave, `↑` la propulsa y `Espacio` dispara una bala por pulsación.
- [ ] Un choque con un asteroide (sin escudo ni invencibilidad) baja las vidas de ambos HUD de 3 a 2.
- [ ] Destruir todos los asteroides sube el nivel de ambos HUD a 2 y genera 5 asteroides grandes.
- [ ] `↓` activa el escudo una vez por vida y se dibuja el indicador `ESCUDO` en el canvas.
- [ ] El Disparo Triple aparece como máximo una vez por nivel y, al recogerlo, `Espacio` lanza 3 balas.
- [ ] PAUSA congela el juego (nave, asteroides y puntuación quietos) y el botón pasa a REANUDAR. REANUDAR lo continúa. La tecla `P` hace lo mismo.
- [ ] Al llegar a 0 vidas el canvas dibuja `GAME OVER` con el `PUNTAJE` y `ESPACIO PARA REINICIAR`, y aparece el modal "FIN DEL JUEGO" con la misma puntuación.
- [ ] Pulsar `Espacio` en GAME OVER (con el foco fuera del modal) reinicia la partida con 0 puntos, 3 vidas y nivel 1 en ambos HUD, y cierra el modal.
- [ ] FIN muestra `GAME OVER` en el canvas y abre el mismo modal con la puntuación actual.
- [ ] En el modal se puede escribir un nombre con espacios en el campo de texto sin que `Espacio` dispare ni se bloquee.
- [ ] GUARDAR PUNTUACIÓN añade a `localStorage.av_scores` una entrada con `game: "asteroids"`, la puntuación y el nombre.
- [ ] JUGAR DE NUEVO reinicia el juego con 0 puntos, 3 vidas y nivel 1 en ambos HUD.
- [ ] Salir de la página y volver no deja dos bucles activos ni listeners duplicados (la nave no se mueve el doble de rápido ni dispara dos balas por pulsación).
- [ ] La línea de controles se ve en `/games/asteroids/play` y no en `/games/rocas/play`.
- [ ] `/games/rocas/play` sigue mostrando la simulación anterior, con puntuación que sube sola.
- [ ] A 375 px de ancho, `/games/asteroids/play` no tiene scroll horizontal y el canvas se escala sin deformarse.
- [ ] La consola del navegador no muestra errores ni avisos de React en `/games/asteroids/play`.
- [ ] `app/data/scores.ts` y `app/components/SessionProvider.tsx` no tienen cambios.

---

## Decisiones

- **Sí:** portar a TypeScript como motor desacoplado de React. El usuario pidió que el juego quede dentro del canvas y que React lo controle y reciba sus cambios de estado. Un motor con callbacks lo cumple y es reutilizable por Tetris y Arkanoid.
- **No:** `iframe` con el HTML original ni `game.js` cargado como script global. Sin tipos, con globales, sin desmontaje limpio y con la puntuación solo por `postMessage`.
- **Sí:** crear un juego nuevo `asteroids` en lugar de reutilizar `rocas`. Decisión del usuario. `rocas` queda como estaba, con su simulación.
- **No:** retirar o fusionar `rocas`. Habrá dos juegos de asteroides en el catálogo; unificarlos es otro trabajo.
- **Sí:** usar los dos HUD. Decisión del usuario: el juego conserva su canvas, controles y HUD, y además notifica a React, cuyo HUD HTML y modal se alimentan de esas notificaciones.
- **No:** retirar el HUD del canvas ni el overlay `GAME OVER`. Se descartó la opción "la plataforma manda" tras la revisión del usuario.
- **Sí:** conservar `ESPACIO PARA REINICIAR` y añadir el evento `onRestart`. Mantiene el control original del juego y evita que React quede desincronizado (modal abierto con partida nueva en marcha).
- **No:** dejar que el motor reinicie sin avisar. El HUD HTML y el modal mostrarían datos de la partida anterior.
- **Sí:** el motor emite `onStats` solo cuando cambia un valor. Evita un `setState` de React por frame.
- **Sí:** evento opcional `onPauseChange` en el contrato. La tecla `P` la gestiona el motor, como se acordó, y sin este evento React no sabría que está pausado y el botón se quedaría en PAUSA con el juego parado. Se descartaron gestionar `P` en `GamePlayer` (contradice el diseño del motor y duplica el filtrado de `input`/`button`) y no avisar a React (incumple el criterio del botón REANUDAR).
- **Sí:** con motor, ocultar el overlay HTML `EN PAUSA`. El canvas ya dibuja `PAUSA`; mostrar ambos superpondría dos textos.
- **Sí:** callbacks en refs dentro de `GameCanvas`. El motor se crea una sola vez por montaje y no se reinicia al re-renderizar `GamePlayer`.
- **Sí:** registro de motores por id en `app/lib/games/registry.ts`. `GamePlayer` decide por `ENGINES[game.id]` y los juegos simulados no cambian.
- **No:** ruta o vista propia para asteroids. Duplicaría HUD y modal.
- **Sí:** PAUSA, FIN, vidas y nivel conectados al motor. Decisión del usuario, sustituye a la simulación en este juego.
- **Sí:** estilo original (vectorial blanco sobre negro) y `localStorage` (`av_scores`). Supabase queda para el spec de base de datos, porque exige tabla, RLS y autenticación real.
- **No:** recolorear con la paleta neón. No se pidió y cambia el aspecto del juego.
- **Sí:** nueva portada `.cover-asteroids` en CSS. Es coherente con las 8 existentes y no añade imágenes.
- **Sí:** resolución interna fija 800×600 escalada con CSS. Conserva la física y las constantes del original sin tocarlas.
- **No:** soporte de `devicePixelRatio`. Pantallas retina verán el canvas algo suave; se aborda aparte si molesta.
- **Sí:** `best: 0` y `plays: "0"` en la entrada del catálogo. Es un juego nuevo y no hay datos reales; no se inventan cifras.
- **Sí:** la entrada va al final de `GAMES`. La Home usa `games.slice(0, 6)` y no cambia.

---

## Riesgos

| Riesgo                                                                                                                  | Mitigación                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StrictMode` monta y desmonta el efecto dos veces en desarrollo y deja dos motores con dos bucles.                      | `destroy()` cancela el `requestAnimationFrame` y quita todos los listeners. Un criterio de aceptación comprueba que no hay velocidad ni disparos duplicados.         |
| El listener de `window` hace `preventDefault` en `Espacio` y bloquea escribir espacios en el campo de nombre del modal. | El motor ignora los eventos de teclado cuyo objetivo sea `input`, `textarea` o `button`.                                          |
| Tras pulsar PAUSA, el botón conserva el foco y `Espacio` lo vuelve a activar en lugar de disparar.                      | `GamePlayer` quita el foco de los botones tras pulsarlos.                                                                                                            |
| Reiniciar con `Espacio` mientras el modal está abierto descarta una puntuación sin guardar.                             | Es el comportamiento original del juego. Se acepta: el motor ignora `Espacio` si el foco está en un `input` o `button` del modal, y solo reinicia con el foco fuera. |
| Los dos HUD muestran valores distintos por un `onStats` perdido.                                                        | El motor emite `onStats` al iniciar, al reiniciar y en cada cambio. Un criterio de aceptación compara ambos HUD.                                                     |
| `onGameOver` se emite dos veces (por ejemplo, 0 vidas y FIN a la vez) y el modal o el guardado se duplican.             | El motor guarda un indicador interno y emite `onGameOver` una sola vez por partida.                                                                                  |
| Las flechas y `Espacio` desplazan la página mientras se juega.                                                          | `preventDefault` en las 5 teclas del juego mientras el motor está activo, como hace el original.                                                                     |
| El canvas se dibuja con `window.devicePixelRatio` distinto de 1 y se ve borroso.                                        | Queda fuera de alcance y anotado en las decisiones.                                                                                                                  |
| La tarjeta nueva rompe criterios de SPEC 01 y SPEC 02 que hablan de "8 tarjetas".                                       | Este spec los sustituye por 9 tarjetas. No se modifican los specs anteriores.                                                                                        |
| `cacheComponents` obliga a tratar de forma explícita los datos asíncronos de la página de juego.                        | El paso 1 revisa la documentación. `GameCanvas` es un componente cliente que no lee datos asíncronos.                                                                |

---

## Qué **no** está en este spec

- Guardado de puntuaciones en Supabase, tabla `scores` y RLS.
- Salón de la Fama con partidas reales.
- Controles táctiles y versión móvil.
- Sonido y música.
- OVNIs y asteroide "estrella fugaz".
- Soporte de `devicePixelRatio`.
- Tetris y Arkanoid.
- Cambios en `rocas`.
- Tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propio spec.
