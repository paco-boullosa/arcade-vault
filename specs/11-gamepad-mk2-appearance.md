# SPEC 11 — Apariencia del gamepad MK-II en el mando táctil

> **Status:** Implementado
> **Depends on:** SPEC 10
> **Date:** 2026-11-20
> **Objective:** Reestilizar el mando táctil móvil de SPEC 10 para que cruz, botones A/B y carcasa tengan la apariencia del gamepad "MK-II" de `references/gamepad-assets/` (cruz en relieve con hub y gema pulsante, botones circulares con brillo y anillo, carcasa con doble borde y textura), con la acción de cada botón abreviada a 3 letras y sin cambiar la lógica de entrada.

---

## Por qué existe este spec

SPEC 10 dio a los 4 juegos con motor un mando táctil funcional, pero su aspecto es plano: botones rectangulares con flechas de texto (`↑ ← → ↓`) y botones de acción con la palabra completa. El diseño ya existe: `references/gamepad-assets/gamepad.html` (CSS y HTML autocontenidos) y `gamepad-neon.png` (captura) definen un gamepad neón con relieve, brillo y estados de pulsación. Este spec lleva ese aspecto al mando real.

El usuario ha decidido (y no quiere reabrir):

- El aspecto se aplica **solo al mando móvil de SPEC 10**. Escritorio no cambia.
- La fila fina (PAUSA, SKIN, extras, FIN, SALIR) queda **fuera y encima de la carcasa**. La carcasa contiene solo la cruz y los botones A/B, como en la referencia.
- Los botones A y B muestran **la acción del juego dentro del círculo, abreviada a 2 o 3 letras** para que quepa.
- Se replican los cuatro elementos decorativos: hub central con gema pulsante, carcasa (degradado, doble borde, textura de puntos), anillo discontinuo al pulsar A/B y flechas SVG en lugar de caracteres.

Notas sobre la referencia:

- `gamepad.html` trae su propio `<script>` de teclado (flechas/WASD, Z/J, X/K) que solo ilumina los botones. **No se importa**: el teclado real ya lo gestionan los motores y los eventos sintéticos de SPEC 10.
- Las fuentes `Press Start 2P` y `JetBrains Mono` ya están cargadas en `app/layout.tsx` y expuestas como `--pixel` y `--mono`; no se añade ningún `<link>` de Google Fonts.
- `--cyan` y `--magenta` ya existen en `app/globals.css` con los mismos valores que la referencia.

---

## Alcance

**Dentro:**

- Restyling visual de `.touch-pad`, `.touch-dpad`, `.touch-dpad-btn` y `.touch-action-btn` en `app/globals.css`, dentro de la media query táctil existente (`max-width: 640px` y `pointer: coarse`) y bajo `.av-player--engine`.
- Carcasa: `.touch-pad` pasa a ser la carcasa del gamepad (degradado, borde, doble borde interior `::before`, textura de puntos `::after`, sombra).
- Cruz: cuatro botones con relieve (sombra inferior, sombra interior) y hub central con gema pulsante, en una caja de 144×144 px con posicionamiento absoluto como la referencia.
- Flechas como SVG inline (`viewBox 0 0 24 24`, los mismos cuatro trazos de la referencia) en lugar de `↑ ← → ↓`.
- Botones A y B circulares: A magenta, B cian, con brillo, borde `currentColor`, sombra de relieve y anillo discontinuo `.touch-ring`. Etiqueta de acción abreviada dentro, en `--pixel`.
- Campo nuevo `short` en `TouchButton` (`app/lib/games/registry.ts`) con la abreviatura de cada acción, usado solo para mostrar. `label` sigue siendo el nombre accesible y el de la fila fina.
- Estado de pulsado `.on` en cada botón, puesto y quitado por `HoldButton` en `pointerdown` y en la liberación (con `:active` como respaldo), porque `:active` es poco fiable en iOS Safari con `setPointerCapture`.
- Estado atenuado (`disabled`) coherente con el nuevo aspecto, y `prefers-reduced-motion` para la gema.
- Ajuste de tamaños por ancho (≥ 360 px y < 360 px) para que la carcasa quepa sin scroll horizontal.
- Diseño y revisión visual con `/frontend-design`, comparando con `gamepad-neon.png`.

**Fuera de alcance (para otros specs):**

- Cambiar la lógica de entrada: teclas sintéticas, repetición de la cruz, multitáctil, liberación de teclas (`touch.ts`, `createKeyHold`), ni el mapeo de teclas por juego.
- Cambiar la fila fina (`.touch-bar`): mismo aspecto y mismos botones que en SPEC 10.
- Mostrar el gamepad en escritorio, tablets o ratón (ni como vista previa).
- Orientación horizontal.
- Soporte de teclado físico sobre el mando (WASD, Z/X) de `gamepad.html`.
- Tocar los motores (`app/games/*`), el contrato `GameEngine` o Supabase.
- Vibración, sonido, pantalla completa.
- Juegos simulados.
- Skins del propio mando (un solo aspecto, el neón de la referencia).
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

Un solo cambio de tipo en `app/lib/games/registry.ts`:

```ts
export type TouchButton = {
  code: string;
  label: string; // nombre completo: aria-label y fila fina
  short: string; // 2–3 letras en mayúsculas, dentro del botón circular
};
```

`short` es obligatorio en `a` y `b`. En `extras` (botones de la fila fina) se usa `label` y `short` no se muestra, pero el tipo es el mismo para no duplicarlo; se rellena igualmente.

Abreviaturas por juego (3 letras, mayúsculas, sin tildes en el círculo para no romper la fuente pixel):

| Juego       | A (`code`)                   | B (`code`)                     | Extras                                               |
| ----------- | ---------------------------- | ------------------------------ | ---------------------------------------------------- |
| `asteroids` | `Space` — `DISPARAR` → `DIS` | `ArrowDown` — `ESCUDO` → `ESC` | —                                                    |
| `tetris`    | `Space` — `CAER` → `CAE`     | `KeyX` — `ROTAR` → `ROT`       | `KeyG` — `FANTASMA` → `FAN`, `KeyM` — `MENÚ` → `MEN` |
| `arkanoid`  | `Space` — `LANZAR` → `LAN`   | sin B (atenuado)               | —                                                    |
| `snake`     | `Space` — `EMPEZAR` → `EMP`  | sin B (atenuado)               | —                                                    |

Cuando un juego no tiene B, el círculo atenuado muestra la letra `B` (no hay acción que abreviar).

Tokens de estilo (variables CSS locales a `.touch-pad`, copiadas de `gamepad.html`): `--ink-dim`, `--line`, `--ab-mid`, `--ab-deep`, `--ab-glow`. Los colores `--cyan` y `--magenta` y las fuentes `--pixel` y `--mono` son los globales existentes.

Estructura del DOM (cambia solo el interior de `.touch-pad`; `.touch-bar` y la jerarquía de `.touch-controls` no cambian):

```tsx
<div className="touch-pad">
  <div className="touch-dpad">
    {/* 4 × HoldButton con <svg className="touch-arrow">… */}
    <div className="touch-hub" aria-hidden="true">
      <span className="touch-hub-gem" />
    </div>
  </div>
  <div className="touch-actions">
    {/* B y A: <span className="touch-ring" /> + <span className="touch-ab-text">DIS</span> */}
  </div>
</div>
```

Dimensiones (de la referencia, en su variante móvil):

| Elemento               | ≥ 360 px                             | < 360 px                       |
| ---------------------- | ------------------------------------ | ------------------------------ |
| Caja de la cruz        | 144×144, botones 46×46, hub 46×46    | igual                          |
| Botones A/B            | 64×64, separación 16                 | 56×56, separación 12           |
| Carcasa (`.touch-pad`) | padding 12/14/10, `border-radius` 16 | igual, `gap` interior reducido |

Este spec no introduce tablas ni cambios en Supabase.

---

## Plan de implementación

1. **Leer el contexto.** `references/gamepad-assets/gamepad.html` y `gamepad-neon.png`, el CSS actual del mando en `app/globals.css` (`.touch-*`) y `TouchControls.tsx`. No genera código. Manual: lista de los selectores `.touch-*` actuales y de los que se renombran o añaden.
2. **Datos.** Añadir `short` a `TouchButton` y rellenar `a`, `b` y `extras` de los 4 juegos en `ENGINES` según la tabla. Manual: `npx tsc --noEmit` sin errores y el mando sigue funcionando igual.
3. **Marcado.** En `TouchControls.tsx`: flechas SVG, hub con gema, `.touch-ring` y `.touch-ab-text` con `short` en A y B, y clase `on` en `HoldButton` (se añade en `pointerdown` y se quita en `pointerup`, `pointercancel`, `lostpointercapture`, `blur`, `visibilitychange` y al desmontar). No se toca `touch.ts`. Manual: `npx tsc --noEmit` y `npm run lint`; el mando aún se ve con estilos viejos pero responde igual.
4. **Carcasa y cruz.** CSS de `.touch-pad` (degradado, bordes, textura, sombra), `.touch-dpad` (caja 144×144), botones de la cruz con relieve, hub y gema con `@keyframes`, y estado `.on`. Manual: a 390×844 con `hasTouch` se ve la cruz con relieve y la gema pulsa.
5. **Botones A/B.** CSS de `.touch-action-btn` (círculo, brillo radial, colores magenta/cian, sombra de relieve, anillo discontinuo, texto `--pixel`) y estados `.on` y atenuado. Manual: A magenta a la derecha de B cian, el texto de 3 letras cabe sin recortarse, el anillo aparece al pulsar.
6. **Tamaños y accesibilidad.** Reglas para < 360 px, `prefers-reduced-motion: reduce` (sin animación de la gema), comprobación de objetivos ≥ 44×44 px y contraste de las etiquetas. Manual: sin scroll horizontal a 320, 360, 390 y 430 px.
7. **Repaso.** `npm run lint`, `npx tsc --noEmit`, `npm run build`; comparar con `gamepad-neon.png` a 390×844; partida de los 4 juegos en emulación táctil (cruz, A, B, pausa, fin, skin); regresión a 1280 px y en ventana estrecha con ratón; consola limpia; retirada de CSS muerto (`.touch-dpad-btn` y `.touch-action-btn` antiguos si ya no se usan).

---

## Criterios de aceptación

**Calidad**

- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [x] La consola no muestra errores ni avisos de React en `/games/<id>/play` de los 4 juegos con motor, a 390 px y a 1280 px.
- [x] `git diff --stat -- app/games app/lib/games/touch.ts supabase` no muestra cambios: motores, teclas sintéticas y Supabase no se tocan.
- [x] No se añade ningún `<link>` a Google Fonts ni ninguna dependencia nueva en `package.json`.

**Aspecto (390×844, `hasTouch`, `pointer: coarse`)**

- [x] `.touch-pad` tiene fondo con degradado, borde y `border-radius` visibles, un pseudo-elemento de doble borde interior y uno de textura de puntos.
- [x] La cruz tiene 4 botones en forma de cruz con sombra de relieve y un hub central con una gema cian que pulsa (la animación `pulse-led` corre).
- [x] Las 4 flechas son `<svg>` y no caracteres de texto (`↑ ← → ↓` no aparecen en el DOM del mando).
- [x] B es un círculo cian y A un círculo magenta, A a la derecha de B, con brillo radial y borde del mismo color.
- [x] Cada círculo de acción muestra su abreviatura de 3 letras (p. ej. `DIS` y `ESC` en Asteroids; `CAE` y `ROT` en Tetris), no se recorta y no se parte en dos líneas. En Arkanoid y Snake, B muestra `B` atenuado.
- [x] El `aria-label` de A y B sigue siendo el nombre completo (`DISPARAR`, `ESCUDO`, `CAER`, `ROTAR`, `LANZAR`, `EMPEZAR`).
- [x] La fila fina (`.touch-bar`) queda fuera de la carcasa, encima de `.touch-pad`, con el mismo aspecto que en SPEC 10.
- [x] Una captura a 390×844 es visualmente equivalente a `gamepad-neon.png` en proporciones, colores y relieve (revisión manual con `/frontend-design`).

**Estados**

- [x] Al pulsar un botón de la cruz, desciende 3 px, se ilumina en cian y su flecha brilla (clase `on` aplicada).
- [x] Al pulsar A o B, el botón desciende 4 px y aparece el anillo discontinuo a opacidad 1.
- [x] La clase `on` se quita al soltar, al cancelar el gesto (`pointercancel`), al perder la captura, al pasar la pestaña a segundo plano y al desmontar: ningún botón queda iluminado tras soltar.
- [x] Los botones atenuados (`↓` en Asteroids, `↑` y `↓` en Arkanoid, B en Arkanoid y Snake) se ven claramente atenuados, no responden al toque y no muestran estado `on`.
- [x] Con `prefers-reduced-motion: reduce` la gema del hub no se anima.

**Tamaño y maquetación**

- [x] Cada botón del mando (cruz, A, B y fila fina) mide al menos 44×44 px CSS a 320, 360, 390 y 430 px.
- [x] No hay scroll horizontal a 320, 360, 390 y 430 px de ancho, ni en el modal de fin de partida.
- [x] A 390×844 y a 360×740 el canvas y el mando completo caben sin scroll vertical (`document.documentElement.scrollHeight` no supera `window.innerHeight`) y el borde inferior de `.touch-controls` coincide con el de la ventana (descontada el área segura).
- [x] A < 360 px los botones A/B miden 56×56 px y la carcasa cabe en el ancho disponible.
- [x] Las etiquetas de A y B tienen un contraste de al menos 4,5:1 sobre el fondo del botón.

**Sin regresiones**

- [x] La entrada táctil sigue como en SPEC 10: los criterios de "Entrada táctil" de SPEC 10 se repiten y se cumplen en los 4 juegos (cruz con repetición 250/70 ms, A, B, multitáctil, sin teclas atascadas, PAUSA, FIN, SALIR, SKIN).
- [x] A 1280 px el reproductor es idéntico al actual y `.touch-controls` no se ve.
- [x] Una ventana de escritorio de 390 px con ratón (`pointer: fine`) muestra el reproductor de escritorio, sin mando.
- [x] Un juego sin motor (`gloton`) a 390 px con puntero táctil conserva su HUD y su barra de navegación y no muestra el mando.

---

## Decisiones

- **Sí:** reestilizar el mando de SPEC 10 en sitio, sin tocar la lógica de entrada, por decisión del usuario. **No:** mostrar el gamepad en escritorio ni como vista previa: sería una funcionalidad nueva con su propia spec.
- **Sí:** la acción dentro del círculo, abreviada a 3 letras, por decisión del usuario. Conserva la información sin romper el diseño circular. **No:** solo la letra A/B de la referencia, porque el jugador no sabría qué hace cada botón. **No:** la palabra completa, que no cabe en 56–64 px con `Press Start 2P`.
- **Sí:** abreviatura de 3 letras, sin tildes (`MEN`, no `MEN`/`MENÚ`). **No:** 2 letras, que serían ambiguas (`CA`, `RO`).
- **Sí:** `short` como campo del registro, junto a `label`. Las abreviaturas son datos de cada juego, igual que `code`. **No:** calcularla recortando `label` (`MENÚ` y `MEN` coincidirían, pero `DISPARAR` → `DIS` o `ESCUDO` → `ESC` no siempre sería lo más legible).
- **Sí:** fila fina fuera y encima de la carcasa, por decisión del usuario. La carcasa queda idéntica a la referencia y se mantiene la estructura de SPEC 10. **No:** meter la fila en la carcasa, que la hace crecer y reduce el canvas a 360×740.
- **Sí:** replicar los cuatro elementos decorativos (hub con gema, carcasa con doble borde y textura, anillo de A/B, flechas SVG), por decisión del usuario.
- **Sí:** clase `on` puesta por `HoldButton` además de `:active`. `:active` con `setPointerCapture` es poco fiable en iOS Safari, y la referencia ya usa una clase `on` en su script. Es un cambio de presentación en el componente, no de lógica de teclas. **No:** cambiar `touch.ts`.
- **Sí:** no importar el `<script>` de `gamepad.html` (teclado WASD y Z/X) ni su `<link>` a Google Fonts: los motores y `layout.tsx` ya cubren ambos.
- **Sí:** reutilizar `--cyan`, `--magenta`, `--pixel` y `--mono` globales. **No:** duplicar los tokens de la referencia, salvo los locales (`--ab-*`, `--line`, `--ink-dim`) que solo existen en el mando.
- **Sí:** tamaños de la variante móvil de la referencia (cruz 144 px, botones 46 px, A/B 64 px) y una reducción a 56 px bajo 360 px. Los objetivos siguen ≥ 44 px (decisión de SPEC 10).
- **Sí:** `prefers-reduced-motion` desactiva la gema. La referencia no lo contempla; es una mejora de accesibilidad sin coste.

---

## Riesgos

| Riesgo                                                                                        | Mitigación                                                                                                          |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| La carcasa con padding y sombras es más alta que el mando actual y el canvas se reduce        | Criterio de caber sin scroll a 390×844 y 360×740; si no cabe, se reduce el padding vertical de `.touch-pad`         |
| A 320 px la fila cruz + A/B no cabe (144 + 14 + 124 + padding ≈ 310 px)                       | Variante < 360 px con A/B de 56 px; criterio de no scroll horizontal a 320 px                                       |
| `:active` no se mantiene en iOS con `setPointerCapture`                                       | Clase `on` explícita puesta y quitada por `HoldButton`                                                              |
| La clase `on` se queda puesta si se pierde un evento de liberación                            | Se quita en `pointerup`, `pointercancel`, `lostpointercapture`, `blur`, `visibilitychange` y al desmontar; criterio |
| `Press Start 2P` a 12–14 px con 3 letras queda ilegible o se desborda en el círculo de 56 px  | Tamaño de fuente medido en revisión visual a 320 y 360 px; contraste ≥ 4,5:1 como criterio                          |
| Los `box-shadow` y `filter: drop-shadow` múltiples encarecen el repintado en móviles modestos | Solo las flechas activas usan `drop-shadow`; se revisa la fluidez en emulación y, si es posible, en un Android real |
| La textura de puntos (`::after`) intercepta toques                                            | `pointer-events: none` en `::before` y `::after`, como en la referencia                                             |

---

## Qué **no** está en este spec

- Cambios en la lógica de entrada, `touch.ts` o el mapeo de teclas.
- Cambios en la fila fina (PAUSA, SKIN, extras, FIN, SALIR).
- Gamepad en escritorio, tablets o ratón.
- Orientación horizontal.
- Teclado físico sobre el mando.
- Cambios en motores, contrato `GameEngine` o Supabase.
- Vibración, sonido y pantalla completa.
- Skins del mando.
- Juegos simulados.
- Tests automatizados.

Cada uno de esos puntos, si se aborda, va en su propia spec.
