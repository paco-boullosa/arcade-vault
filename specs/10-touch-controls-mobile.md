# SPEC 10 — Controles táctiles para jugar en el móvil

> **Status:** Aprobado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 08, SPEC 09
> **Date:** 2026-11-20
> **Objective:** Añadir al reproductor, solo en dispositivos móviles (ancho de hasta 640 px y puntero táctil), un mando táctil (cruz de dirección, dos botones de acción y una fila de PAUSA, SKIN, FIN y SALIR) anclado en la parte inferior de la ventana, con la barra de navegación oculta en esa pantalla, para poder jugar a Asteroids, Tetris, Arkanoid y Snake con el dedo sin tocar los motores.

---

## Por qué existe este spec

Hoy los 4 juegos con motor real solo se controlan con teclado: cada motor escucha `keydown` y `keyup` en `window` y lee `e.code`. En un móvil no hay teclado físico, así que no se puede empezar, mover, pausar ni reiniciar ninguna partida. Además, el reproductor de `/games/[id]/play` está pensado para escritorio: en la captura de un Android real (320 px de ancho útil) el HUD HTML ocupa media pantalla, el canvas queda empujado hacia abajo y la barra `.crt-bottom` se rompe en varias líneas.

El usuario ha decidido (y no quiere reabrir):

- Mantener los motores intactos: los mandos en pantalla **disparan eventos de teclado sintéticos en `window`**. El teclado real sigue funcionando igual.
- Diseño de pantalla vertical: canvas arriba y debajo el mando, con un sector de dirección a la izquierda y dos botones de acción a la derecha.
- Quitar el HUD HTML entero en táctil (el canvas ya dibuja lo esencial). PAUSA, SKIN, FIN y SALIR pasan a una fila fina encima de la cruz.
- Activar el modo táctil solo en dispositivos móviles: `max-width: 640px` **y** `pointer: coarse`. Una ventana estrecha de escritorio con ratón no ve el mando.
- En la pantalla de juego con el mando visible, ocultar por completo la barra de navegación del sitio (`Nav`).
- El mando va pegado al borde inferior de la ventana, para alcanzarlo cómodamente con los pulgares.
- Solo orientación vertical. Afecta a los 4 juegos con motor real; los simulados no se tocan.

---

## Alcance

**Dentro:**

- Componente `app/components/TouchControls.tsx`: cruz de 4 botones, botones A y B, y fila de PAUSA, SKIN, FIN, SALIR más botones extra por juego.
- Utilidad `app/lib/games/touch.ts` que crea y envía `KeyboardEvent` sintéticos a `window`, con repetición automática en la cruz.
- Campo nuevo `touch` en `GameDefinition` (`app/lib/games/registry.ts`) con la configuración de cada juego.
- Integración en `GamePlayer`: el mando se renderiza para juegos con motor y se reutilizan `togglePause` y `finish`.
- CSS en `app/globals.css`, dentro de `@media (max-width: 640px) and (pointer: coarse)`: se oculta el HUD HTML (`.player-hud`), la barra `.crt-bottom`, la línea de controles de teclado, la barra de navegación (`.av-nav`) y el pie (`Footer`), y se muestra el mando.
- Maquetación de pantalla completa en móvil: `.av-player` ocupa `100dvh` como columna flex, el canvas queda arriba y `.touch-controls` es el último hijo, pegado al borde inferior de la ventana, respetando el área segura (`env(safe-area-inset-bottom)`). La página no hace scroll.
- La barra de navegación se oculta solo en `/games/<id>/play` de juegos con motor, con la clase `av-touch-play` que `GamePlayer` pone en `<body>` mientras está montado, porque `Nav` vive en `app/layout.tsx`, fuera de `GamePlayer`.
- Soporte multitáctil (dedo en la cruz y dedo en un botón de acción a la vez) y soltado de teclas al cancelar, perder el foco o desmontar.
- Prevención de scroll, zoom por doble toque, selección y menú contextual sobre el canvas y el mando (`touch-action`, `user-select`).
- Diseño visual con `/frontend-design`, en la línea neón del resto de la plataforma.

**Fuera de alcance (para otros specs):**

- Orientación horizontal. En horizontal un móvil supera los 640 px y muestra el reproductor de escritorio, sin mando.
- Tablets y pantallas táctiles de más de 640 px de ancho: siguen con el reproductor de escritorio, sin mando.
- Gestos sobre el canvas (deslizar, tocar para disparar) y joystick analógico.
- Ocultar la barra de navegación en otras pantallas o en escritorio.
- Vibración (`navigator.vibrate`), sonido y pantalla completa.
- Cambiar el contrato `GameEngine` o los motores (`app/games/*`). Una API táctil nativa queda para otra spec.
- Hacer más legibles los textos dibujados en el canvas cuando se escala a ~0,45.
- Mapeos de botones configurables por el jugador.
- Juegos simulados (`gloton`, `invasores`, `ranaria`, `duelo-pixel`, `serpentina`, `caida`, `bloque-buster`, `rocas`).
- Cambiar el `viewport` para bloquear el zoom de pellizco.
- Gamepad físico.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

Configuración táctil por juego. Se añade a `GameDefinition` en `app/lib/games/registry.ts`:

```ts
export type TouchButton = { code: string; label: string };

export type TouchConfig = {
  // false = el botón se muestra atenuado y no envía nada
  dpad: { up: boolean; down: boolean; left: boolean; right: boolean };
  a: TouchButton; // botón de acción principal
  b?: TouchButton; // si falta, se muestra atenuado y sin acción
  skin: string; // KeyboardEvent.code que cambia la skin del juego
  extras?: TouchButton[]; // botones extra de la fila fina
};

export type GameDefinition = {
  // ...campos existentes
  touch: TouchConfig;
};
```

Valores por juego (los `code` salen de cada motor):

| Juego       | Cruz (↑ ↓ ← →)            | A                    | B                      | Skin   | Extras                               |
| ----------- | ------------------------- | -------------------- | ---------------------- | ------ | ------------------------------------ |
| `asteroids` | ↑ sí · ↓ no · ← sí · → sí | `Space` — `DISPARAR` | `ArrowDown` — `ESCUDO` | `KeyS` | —                                    |
| `tetris`    | las 4 activas             | `Space` — `CAER`     | `KeyX` — `ROTAR`       | `KeyS` | `KeyG` — `FANTASMA`, `KeyM` — `MENÚ` |
| `arkanoid`  | ← sí · → sí · ↑ no · ↓ no | `Space` — `LANZAR`   | sin B (atenuado)       | `KeyS` | —                                    |
| `snake`     | las 4 activas             | `Space` — `EMPEZAR`  | sin B (atenuado)       | `KeyK` | —                                    |

Notas del mapeo:

- En Asteroids `↓` es el escudo, que ya cubre el botón B, así que la cruz no lo repite.
- `Space` también sirve para confirmar y reiniciar: el menú de Tetris acepta `Enter` o `Space`, Arkanoid continúa con `Enter` o `Space` y Snake y Tetris reinician con `Space`. Por eso A usa siempre `Space`.
- El menú inicial de Tetris se maneja con `↑` `↓` de la cruz y A.

Constantes de la repetición automática (`app/lib/games/touch.ts`), equivalentes a mantener una tecla pulsada:

```ts
export const TOUCH_REPEAT = { delayMs: 250, intervalMs: 70 };
```

Comportamiento de las teclas sintéticas:

- Cada evento se crea con `new KeyboardEvent(type, { code, bubbles: true, cancelable: true, repeat })` y se envía a `window`. Como el objetivo es `window`, no un `button` o `input`, pasa el filtro `isIgnoredTarget` de los motores.
- Pulsar un botón envía `keydown` (`repeat: false`). Soltarlo envía `keyup`.
- Solo los 4 botones de la cruz repiten: pasado `delayMs` envían `keydown` con `repeat: true` cada `intervalMs`. Tetris mueve la pieza en cada `keydown`. A, B y extras no repiten, porque `Space` repetido volvería a hacer `CAER` en cada evento.
- Una tecla se libera (`keyup`) al soltar, con `pointercancel`, con `blur` de la ventana, con `visibilitychange` a oculto y al desmontar el componente.
- PAUSA no usa `KeyP`: llama al `togglePause` que ya usa el botón HTML, de modo que el estado de React y el canvas siguen sincronizados. FIN llama a `finish`. SALIR es el `Link` a `/games/${game.id}`.

Estructura del DOM del mando (dentro de `.av-player`, como último hijo, después de `.crt`; en móvil se pega al borde inferior de la ventana):

```tsx
<div className="touch-controls">
  <div className="touch-bar">{/* PAUSA · SKIN · extras · FIN · SALIR */}</div>
  <div className="touch-pad">
    <div className="touch-dpad">{/* ↑ ← → ↓ */}</div>
    <div className="touch-actions">{/* B y A */}</div>
  </div>
</div>
```

Este spec no introduce tablas ni cambios en Supabase.

---

## Plan de implementación

1. **Leer la documentación.** Las guías de `node_modules/next/dist/docs/01-app` relevantes para componentes cliente y CSS global, y `GamePlayer.tsx`, `GameCanvas.tsx` y la entrada de teclado de los 4 motores. No genera código.
2. **Utilidad de teclas sintéticas.** Crear `app/lib/games/touch.ts` con `TOUCH_REPEAT`, el envío de `keydown` y `keyup` a `window` y un objeto `createKeyHold(code, { repeat })` con `press()` y `release()` (el temporizador de repetición se cancela en `release()`). Manual: `npx tsc --noEmit` sin errores.
3. **Configuración por juego.** Añadir `TouchButton`, `TouchConfig` y el campo `touch` a `GameDefinition` y rellenar las 4 entradas de `ENGINES` según la tabla. Manual: `npx tsc --noEmit` sin errores y los 4 juegos siguen arrancando igual.
4. **Componente del mando.** Crear `TouchControls.tsx` (pointer events con `setPointerCapture`, multitáctil, liberación de teclas en `pointercancel`, `blur`, `visibilitychange` y al desmontar). Aún sin estilos finales y oculto con `display: none` en CSS. Manual: `npx tsc --noEmit`.
5. **Integrar en `GamePlayer`.** Renderizar `TouchControls` tras `.crt` solo si el juego tiene motor, pasando `touch`, `paused`, `togglePause`, `finish` y el `href` de salida, y añadir a `.av-player` una clase `av-player--engine`. Manual: en escritorio y en una ventana estrecha con ratón la página no cambia.
6. **Maquetación móvil.** En `app/globals.css`, dentro de `@media (max-width: 640px) and (pointer: coarse)` y solo bajo `.av-player--engine`: ocultar `.player-hud`, `.crt-bottom` y la línea de controles de teclado; reducir el padding de `.crt`; mostrar `.touch-controls`; aplicar `touch-action: none`, `user-select: none` y `-webkit-touch-callout: none` al canvas y al mando. Manual: en emulación móvil con `hasTouch` aparece el mando y se juega.
7. **Pantalla completa y mando abajo.** En la misma media query: ocultar `.av-nav` y el pie con `body.av-touch-play` (clase puesta por `GamePlayer` con un `useEffect` con cleanup), quitar el padding vertical de `.av-main` en esta pantalla, hacer `.av-player` una columna flex de `100dvh` sin scroll y pegar `.touch-controls` al borde inferior (último hijo, con `padding-bottom: env(safe-area-inset-bottom)`). Manual: a 390×844 no hay barra de navegación y el mando toca el borde inferior de la ventana.
8. **Estilo del mando.** Diseñar la cruz, los botones A y B, la fila fina y los estados `activo` y `atenuado` con `/frontend-design`, en la línea neón de la plataforma, con objetivos táctiles de al menos 44×44 px. Manual: revisión visual a 360, 390 y 430 px.
9. **Repaso.** `npm run lint`, `npx tsc --noEmit`, `npm run build`, partida de cada juego en emulación táctil (viewport 390×844 con `hasTouch` y `isMobile`) y, si es posible, en un Android real, consola, comprobación del teclado a 1280 px y en una ventana estrecha con ratón, partida guardada y retirada de código muerto.

---

## Criterios de aceptación

**Calidad**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] La consola no muestra errores ni avisos de React en `/games/<id>/play` de los 4 juegos, ni a 390 px ni a 1280 px.
- [ ] `git diff --stat -- app/games` no muestra cambios: los motores no se tocan.
- [ ] A 375 px de ancho no hay scroll horizontal en `/games/<id>/play` ni en el modal de fin de partida.

**Escritorio y no móvil**

- [ ] A 1280 px el reproductor es idéntico al actual: se ve `.player-hud`, `.crt-bottom`, la línea de controles de teclado, la barra de navegación y el pie, y `.touch-controls` no se ve.
- [ ] A 1280 px el teclado sigue funcionando en Asteroids, Tetris, Arkanoid y Snake (mover, empezar, pausar con `P` y cambiar skin).
- [ ] Una ventana de escritorio de 390 px de ancho con ratón (`pointer: fine`) muestra el reproductor de escritorio: `.touch-controls` no se ve y la barra de navegación sí.
- [ ] Una pantalla táctil de más de 640 px de ancho (p. ej. una tablet) muestra el reproductor de escritorio y no el mando.

**Maquetación móvil (640 px o menos con `pointer: coarse`)**

- [ ] En los 4 juegos con motor, `.player-hud`, `.crt-bottom`, la línea de controles de teclado, la barra de navegación (`.av-nav`) y el pie no se muestran (`display: none` calculado).
- [ ] El canvas ocupa el ancho disponible, conserva la proporción 4:3 y queda por encima del mando.
- [ ] Bajo el canvas, en este orden, se ve la fila fina (PAUSA, SKIN, FIN y SALIR, más FANTASMA y MENÚ en Tetris) y debajo la cruz a la izquierda y los botones B y A a la derecha.
- [ ] El borde inferior de `.touch-controls` coincide con el borde inferior de la ventana (descontado el área segura) a 390×844 y a 360×740.
- [ ] A 390×844 y a 360×740 el canvas y el mando completo caben sin scroll vertical: `document.documentElement.scrollHeight` no supera `window.innerHeight`.
- [ ] Al abrir el modal de fin de partida, el mando sigue en su sitio y el modal queda por encima.
- [ ] Cada botón del mando mide al menos 44×44 px CSS.
- [ ] Las etiquetas del mando tienen un contraste de al menos 4,5:1 sobre su fondo.
- [ ] Un juego sin motor (`gloton`) a 390 px con puntero táctil conserva su HUD y su barra de navegación y no muestra el mando.
- [ ] La barra de navegación sigue visible en el resto de pantallas (`/`, `/games`, `/games/<id>`, `/hall-of-fame`, `/about`) a 390 px con puntero táctil.
- [ ] Al salir del juego con SALIR (navegación cliente) y volver a `/games/<id>`, la barra de navegación se ve y la página hace scroll (la clase `av-touch-play` ya no está en `<body>`).

**Entrada táctil**

- [ ] Snake: pulsar una flecha de la cruz arranca la partida y gira la serpiente; tras `Game over`, un toque en A reinicia con puntuación 0; SKIN cambia la skin y el nombre aparece en el canvas.
- [ ] Arkanoid: mantener `←` o `→` mueve la pala y al soltar se detiene; A lanza la bola, continúa tras `Nivel N completado` y reinicia tras `Game over`.
- [ ] Asteroids: mantener `←` o `→` rota la nave de forma continua y `↑` propulsa; A dispara; mantener B activa el escudo y al soltar se apaga.
- [ ] Tetris: en el menú, `↑` y `↓` de la cruz cambian el modo y A lo elige; mantener `←`, `→` o `↓` repite el movimiento (primer paso inmediato, repetición tras 250 ms y cada 70 ms); un toque en B rota la pieza una sola vez; A hace caer la pieza; FANTASMA alterna la pieza fantasma; MENÚ vuelve al menú desde `Game over`.
- [ ] Los botones atenuados (`↓` en Asteroids, `↑` y `↓` en Arkanoid, B en Arkanoid y Snake) no envían ninguna tecla.
- [ ] Se puede mantener un dedo en la cruz y tocar A con otro a la vez (p. ej. rotar y disparar en Asteroids).
- [ ] Soltar el dedo fuera del botón, cancelar el gesto, pasar la pestaña a segundo plano o salir de la página no deja ninguna tecla atascada: la nave deja de rotar y la pala deja de moverse.
- [ ] PAUSA congela el juego y el botón pasa a REANUDAR; FIN abre el modal con la puntuación actual; SALIR lleva a `/games/<id>`.
- [ ] La repetición de teclas del mando no crea bucles duplicados tras el doble montaje de StrictMode ni tras salir y volver al juego.

**Gestos del navegador**

- [ ] Arrastrar el dedo sobre el canvas o sobre el mando no desplaza la página (`window.scrollY` no cambia).
- [ ] El canvas y `.touch-controls` tienen `touch-action: none` y `user-select: none` calculados.
- [ ] Una pulsación larga o un doble toque sobre un botón no abre menú contextual, no selecciona texto y no hace zoom.

**Leaderboard**

- [ ] Al terminar una partida en emulación táctil se abre el modal con la misma puntuación, se puede escribir un nombre con espacios (sin que `Espacio` reinicie ni `P` pause) y GUARDAR PUNTUACIÓN inserta una sola fila en `scores` con el `game_id` correcto.
- [ ] Tras las pruebas, `scores` no contiene filas de prueba.
- [ ] Una búsqueda de `service_role` en `app/` no da resultados.

---

## Decisiones

- **Sí:** eventos de teclado sintéticos en `window`, por decisión del usuario. Los 4 motores quedan intactos y el teclado sigue igual. **No:** ampliar el contrato `GameEngine` con una API de entrada, que obligaría a tocar los 4 motores y el contrato.
- **Sí:** cruz de 4 botones con repetición automática en la cruz. Reproduce mantener una tecla, que es lo que esperan Asteroids y Arkanoid (estado de tecla) y Tetris (movimiento por `keydown`). **No:** joystick analógico ni gestos sobre el canvas, que no sirven para Tetris y Asteroids, que necesitan varias acciones a la vez.
- **Sí:** repetición solo en la cruz, con `delayMs: 250` e `intervalMs: 70`. **No:** repetir A y B: `Space` repetido volvería a hacer `CAER` en Tetris.
- **Sí:** A siempre es `Space` y B es `ArrowDown` (Asteroids) o `KeyX` (Tetris). `Space` cubre empezar, lanzar, disparar, caer, continuar y reiniciar en los 4 juegos. **No:** `Enter` como botón propio, que `Space` ya cubre.
- **Sí:** B atenuado y sin acción en Arkanoid y Snake, para que la disposición sea idéntica en los 4 juegos. **No:** ocultar B ni cambiar la forma del mando por juego.
- **Sí:** fila fina con PAUSA, SKIN, FIN y SALIR, y botones extra por juego (FANTASMA y MENÚ en Tetris) declarados en el registro. **No:** menú de modos propio en React para Tetris.
- **Sí:** PAUSA llama a `togglePause` y FIN a `finish`, los mismos manejadores que el HUD HTML. **No:** enviar `KeyP` sintético, que dejaría el estado de React desincronizado en el caso del botón y no cubriría la pausa en `Game over`.
- **Sí:** SKIN envía la tecla de skin de cada motor (`KeyS`, y `KeyK` en Snake). Las skins viven en cada motor. **No:** un selector de skin en React.
- **Sí:** quitar el HUD HTML, la barra `.crt-bottom` y la línea de controles de teclado en modo móvil, por decisión del usuario. El canvas ya dibuja puntuación, nivel y (en Arkanoid) vidas. **No:** compactar el HUD en una línea.
- **Sí:** activar el modo móvil con `@media (max-width: 640px) and (pointer: coarse)`, solo con CSS y sin JS, por decisión del usuario ("el pad solo en dispositivos móviles"). **No:** solo el ancho, que mostraría el mando en una ventana estrecha de escritorio con ratón (decisión previa, revisada). **No:** `matchMedia` en React.
- **Sí:** ocultar la barra de navegación con `body.av-touch-play .av-nav` dentro de esa media query, por decisión del usuario. `Nav` está en `app/layout.tsx`, fuera de `GamePlayer`; `GamePlayer` (ya cliente) añade la clase a `<body>` en un `useEffect` y la quita en el cleanup, sin convertir el layout en cliente ni duplicar `Nav`. **No:** ocultarlo en juegos sin motor ni en otras pantallas. **No:** `body:has(.av-player--engine)`, la opción original: con la navegación cliente Next conserva la página anterior oculta en el DOM, el selector seguía activo en la ficha del juego y dejaba esa pantalla sin navegación ni scroll (decisión revisada tras probarlo).
- **Sí:** SALIR (en la fila fina) es la salida del juego mientras la barra de navegación está oculta.
- **Sí:** ocultar también el pie en esta pantalla. Es una consecuencia de la pantalla completa sin scroll (con el mando pegado abajo, el pie quedaría inalcanzable o tapado). No lo pidió el usuario: queda anotado para que lo revise. **No:** dejar el pie y permitir scroll.
- **Sí:** mando como último hijo de una columna flex de `100dvh`, pegado al borde inferior con `padding-bottom: env(safe-area-inset-bottom)`, por decisión del usuario. **No:** `position: fixed`, que tapa contenido y falla con la barra de direcciones del móvil. **No:** centrar el canvas en el espacio libre: va arriba, como en el boceto.
- **Sí:** solo vertical, por decisión del usuario. Es lo que cabe en un solo spec y evita un segundo diseño.
- **Sí:** `touch-action: none`, `user-select: none` y `-webkit-touch-callout: none` en el canvas y el mando. **No:** tocar el `viewport` para bloquear el zoom de pellizco, porque perjudica la accesibilidad.
- **Sí:** pointer events con `setPointerCapture`. Unifican ratón, lápiz y dedo y permiten multitáctil. **No:** `touchstart` y `touchend`, que no capturan el puntero y duplican eventos con el ratón emulado.
- **Sí:** objetivos de al menos 44×44 px. Es el mínimo habitual para botones táctiles.
- **Sí:** el mando se renderiza siempre para juegos con motor y CSS decide si se ve. **No:** `matchMedia` en React, que provocaría un renderizado distinto en servidor y cliente.

---

## Riesgos

| Riesgo                                                                                              | Mitigación                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Teclas atascadas si el dedo sale del botón o se cancela el gesto                                    | `setPointerCapture`, `pointercancel`, `blur`, `visibilitychange` y desmontaje liberan todas las teclas; criterio de aceptación                                                             |
| En horizontal el móvil supera 640 px y muestra el reproductor sin mando                             | Decisión asumida del usuario (solo vertical). Se avisa en el spec y queda fuera de alcance; otra spec puede ampliar la condición                                                           |
| Un móvil con teclado o ratón conectado (`pointer: fine` principal) no ve el mando                   | Es lo esperado: con un puntero principal fino se usa el teclado. Criterio de aceptación en ventana estrecha con ratón                                                                      |
| Next conserva la página anterior oculta en el DOM al navegar y su clase de `<body>` se queda puesta | La clase se pone y se quita en un `useEffect` con cleanup, que también corre cuando Next oculta la página. Criterio de aceptación: volver a la ficha con SALIR muestra navegación y scroll |
| `100dvh` y la barra de direcciones del móvil dejan el mando fuera de pantalla                       | Se usa `dvh` (no `vh`), `env(safe-area-inset-bottom)` y se comprueba a 390×844 y 360×740; criterio de aceptación                                                                           |
| El canvas se escala a ~0,45 y los textos dibujados quedan pequeños                                  | Fuera de alcance. Se revisa en la emulación y, si molesta, se aborda en otra spec sobre legibilidad                                                                                        |
| Repetición de la cruz: `↑` en Tetris rota la pieza en cada repetición                               | Mismo comportamiento que mantener `↑` con el teclado. Para rotar una vez, B envía `KeyX` sin repetir                                                                                       |
| El canvas y el mando no caben sin scroll en pantallas bajas (≤ 740 px)                              | Sin barra de navegación hay más sitio. Criterio verificado a 390×844 y 360×740; si no cabe, se reduce el padding del mando                                                                 |
| El doble montaje de StrictMode deja temporizadores de repetición duplicados                         | `release()` cancela el temporizador y el desmontaje libera las teclas; criterio de aceptación                                                                                              |
| Los navegadores móviles muestran selección o menú contextual al mantener pulsado                    | `user-select: none`, `-webkit-touch-callout: none` y `contextmenu` con `preventDefault` en el mando                                                                                        |
| Probar solo en emulación y no en un móvil real                                                      | El plan incluye una prueba en un Android real por red local si es posible; la emulación con `hasTouch` es el mínimo exigido                                                                |

---

## Qué **no** está en este spec

- Orientación horizontal.
- Mando en tablets y pantallas táctiles de más de 640 px.
- Ocultar la barra de navegación fuera de la pantalla de juego móvil.
- Gestos sobre el canvas y joystick analógico.
- Vibración, sonido y pantalla completa.
- Cambios en el contrato `GameEngine` o en los motores.
- Textos del canvas más legibles al escalar.
- Mapeos configurables por el jugador.
- Juegos simulados.
- Bloqueo del zoom de pellizco en el `viewport`.
- Gamepad físico.
- Tests automatizados.

Cada uno de esos puntos, si se aborda, va en su propia spec.
