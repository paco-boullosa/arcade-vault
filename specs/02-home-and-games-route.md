# SPEC 02 — Nueva Home en `/` y biblioteca en `/games`

> **Status:** Implementado
> **Depends on:** SPEC 01
> **Date:** 2026-11-17
> **Objective:** Mover la biblioteca actual de `/` a `/games` y crear una nueva Home de aterrizaje en `/` basada en `references/templates/home-about/home.jsx`, con el nav actualizado según `references/templates/home-about/nav.jsx`.

---

## Por qué existe este spec

El SPEC 01 dejó la biblioteca como pantalla de inicio. La plantilla `home-about` separa una landing de marketing (hero, ventajas, juegos destacados, actividad, precios) de la biblioteca de juegos. Este spec hace esa separación sin tocar el contenido de la biblioteca: solo cambia su URL. Los criterios de aceptación del SPEC 01 que citan `/` como biblioteca quedan sustituidos por los de este spec.

---

## Alcance

**Dentro:**

- La biblioteca actual (hero, buscador, chips, 8 tarjetas) pasa a `/games`, sin cambios de contenido.
- Nueva Home en `/` con las siete secciones de `home.jsx`: hero con siluetas flotantes, "¿Por qué Arcade Vault?", "Juegos disponibles ahora", franja de estadísticas, "Actividad en vivo", "Precios" y CTA final.
- Animación de aparición al hacer scroll (clase `.reveal`) mediante `IntersectionObserver`.
- Nav con tres destinos: Inicio (`/`), Biblioteca (`/games`) y Salón de la Fama (`/hall-of-fame`), tanto en la barra como en el panel móvil.
- Datos ficticios de la Home (últimas puntuaciones y top de jugadores) aislados en `app/data/activity.ts`.
- Las 6 mini-tarjetas de la Home salen de `getGames()`.
- Estilos de la Home y de actividad/precios copiados de `references/templates/home-about/styles.css` a `app/globals.css`.
- Enlaces "volver al vault" redirigidos a `/games`.
- Metadatos de las rutas `/` y `/games`.

**Fuera de alcance (para otros specs):**

- La página "Acerca de" (`about.jsx`) y su enlace en el nav.
- Corregir las cifras y afirmaciones de marketing de la plantilla ("12+ JUEGOS", "MILES DE PARTIDAS", "Nuevos juegos cada mes", etc.). Se portan literalmente.
- Datos reales de actividad, ranking en vivo o estadísticas calculadas.
- Registro real: los botones "CREAR CUENTA" y "EMPEZAR GRATIS" solo navegan a `/auth`, sin preseleccionar la pestaña de crear cuenta.
- Redirecciones de `/` antiguo: no hay enlaces externos que mantener.
- Cambios en `AuthForm`: sigue redirigiendo a `/` tras iniciar sesión o jugar como invitado.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

Solo se añade el módulo de datos ficticios de la Home. `Game` y `getGames()` se reutilizan del SPEC 01.

```ts
// app/data/activity.ts
export type NeonColor = "cyan" | "magenta" | "yellow" | "green";

export type RecentScore = {
  player: string;   // p. ej. "NEONFOX"
  game: string;     // título literal de la plantilla, p. ej. "Caída"
  score: number;
  ago: string;      // texto ya formateado, p. ej. "hace 2 min"
  color: NeonColor;
};

export type TopPlayer = { rank: number; player: string; score: number };

export async function getRecentScores(): Promise<RecentScore[]>; // 7 filas
export async function getTopPlayers(): Promise<TopPlayer[]>;     // 5 filas
```

Convenciones:

- Las 7 puntuaciones recientes y los 5 jugadores del top se portan literalmente desde `home.jsx`.
- Los números se formatean con `toLocaleString("es-ES")`.
- Las funciones son `async` y devuelven datos fijos, igual que `app/data/games.ts` y `app/data/scores.ts`.

---

## Plan de implementación

Cada paso deja la app arrancando con `npm run dev` y es commiteable por separado.

1. **Leer la documentación de Next.js.** Revisar en `node_modules/next/dist/docs/01-app` lo que afecta a este spec: `page.tsx` como componente de servidor con datos asíncronos bajo `cacheComponents`, `metadata` por ruta y `next/link`. Ajustar los pasos siguientes si algo contradice este plan. No genera código.
2. **Biblioteca en `/games`.** Crear `app/games/page.tsx` con el contenido actual de `app/page.tsx` (carga `getGames()` y renderiza `LibraryView`; `metadata.title` = `Arcade Vault · Biblioteca`). `app/page.tsx` se queda como está por ahora.
3. **Enlaces "volver al vault".** Cambiar de `/` a `/games` en `app/components/GamePlayer.tsx` (botón del modal), `app/components/HallOfFameView.tsx` (botón de volver) y `app/games/[id]/page.tsx` ("VOLVER AL VAULT"). `AuthForm` y el logo del nav siguen apuntando a `/`.
4. **Nav.** En `app/components/Nav.tsx` añadir "Inicio" (`/`, activo solo con `pathname === "/"`), cambiar "Biblioteca" a `/games` (activo con `pathname.startsWith("/games")`) y repetir ambos cambios en el panel móvil. El enlace "Acerca de" no se añade.
5. **Datos de actividad.** Crear `app/data/activity.ts` con los tipos y las dos funciones. Verificar con `npm run lint` y `npx tsc --noEmit`.
6. **Estilos de la Home.** Copiar a `app/globals.css`, sin tocar las reglas existentes, los bloques de `references/templates/home-about/styles.css` correspondientes a: `HOME PAGE` (`.home`, `.home-hero`, `.home-title`, `.home-silos`, `.home-section`, `.section-head`, `.feature-*`, `.mini-*`, `.home-stats`, `.stat-block`, `.home-final`, `.reveal`, `@keyframes bounce` y `float`), `ACTIVITY` (`.activity-*`, `.ac-*`, `.ticker`, `.tick-row`, `.top-*`, `.tp-*`, `.lb-link`, `@keyframes tickin` y `pulse-led`) y `PRICING` (`.pricing-*`, `.price-card`, `.pc-*`, `.faq-*`), incluidos sus `@media`. Omitir lo que ya exista en `globals.css` (`.fade-in`, `@keyframes fadeIn`, `.btn.xl`, `.btn.pulse`).
7. **Siluetas e iconos.** Crear `app/components/FloatingSilhouettes.tsx` (servidor, las 8 siluetas SVG de la plantilla) y `app/components/FeatureIcon.tsx` (servidor, iconos `GAMEPAD`, `FREE`, `TROPHY` y `ROCKET`). Portar los SVG literalmente, con atributos en camelCase (`strokeWidth`).
8. **Vista de la Home.** Crear `app/components/HomeView.tsx` (`'use client'`) con las siete secciones y un `useEffect` que aplica `.in` a los `.reveal` con `IntersectionObserver` (umbral 0.12) y se desconecta en el cleanup. Recibe `games`, `recent` y `top` por props. Los botones de la plantilla pasan a `next/link` con clase `btn`: "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS" e "INSERTAR MONEDA" van a `/games`; "CREAR CUENTA" y "EMPEZAR GRATIS" a `/auth`; "VER SALÓN" a `/hall-of-fame`; cada mini-tarjeta a `/games/<id>`.
9. **Home en `/`.** Reescribir `app/page.tsx` como componente de servidor que carga `getGames()`, `getRecentScores()` y `getTopPlayers()` y renderiza `HomeView` con `games.slice(0, 6)`. `metadata.title` = `Arcade Vault · Inicio`.
10. **Repaso visual.** Comparar `/` con `home.jsx` y el nav con `nav.jsx` en escritorio y a 375 px de ancho, comprobar que `/games` es idéntica a la antigua `/` y retirar código muerto.

---

## Criterios de aceptación

- [x] `npm run lint` termina sin errores.
- [x] `npm run build` termina sin errores.
- [x] `/games` muestra el hero, el buscador, los 5 chips de categoría y las 8 tarjetas de juego.
- [x] Escribir `xyz` en el buscador de `/games` muestra "NO HAY RESULTADOS" y 0 tarjetas.
- [x] Pulsar una tarjeta de `/games` navega a `/games/<id>` de ese juego.
- [x] `/` muestra el título "EL ARCADE CLÁSICO ESTÁ DE VUELTA", los botones "EXPLORAR JUEGOS" y "CREAR CUENTA", y las 8 siluetas flotantes.
- [x] `/` muestra, en este orden, las secciones `// 01` a `// 04`, la franja de estadísticas entre la 02 y la 03, y el bloque "¿LISTO PARA JUGAR?".
- [x] La sección "JUEGOS DISPONIBLES AHORA" muestra 6 mini-tarjetas, las 6 primeras de `getGames()`.
- [x] La sección "ACTIVIDAD EN VIVO" muestra 7 filas de últimas puntuaciones y 5 del top de jugadores, con las 3 primeras del top destacadas.
- [x] Las secciones de `/` con clase `.reveal` empiezan ocultas y aparecen al hacer scroll hasta ellas.
- [x] "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS" e "INSERTAR MONEDA" llevan a `/games`.
- [x] "CREAR CUENTA" y "EMPEZAR GRATIS" llevan a `/auth`.
- [x] "VER SALÓN →" lleva a `/hall-of-fame`.
- [x] Pulsar una mini-tarjeta de la Home lleva a `/games/<id>` de ese juego.
- [x] El nav muestra exactamente los enlaces Inicio, Biblioteca y Salón de la Fama, y ninguno es "Acerca de".
- [x] "Inicio" aparece resaltado en `/` y no en `/games`; "Biblioteca" aparece resaltado en `/games` y en `/games/<id>`.
- [x] "VOLVER AL VAULT" en `/games/<id>`, el botón equivalente del modal del reproductor y el botón de volver de `/hall-of-fame` llevan a `/games`.
- [x] Iniciar sesión o jugar como invitado en `/auth` redirige a `/`.
- [x] A 375 px de ancho `/` no tiene scroll horizontal, y el panel móvil del nav incluye Inicio, Biblioteca y Salón de la Fama.
- [x] La consola del navegador no muestra errores ni avisos de React en `/` ni en `/games`.

---

## Decisiones

- **Sí:** omitir el enlace "Acerca de" del nav. Evita un enlace muerto hasta que exista `/about`, que va en otro spec.
- **No:** portar `about.jsx` aquí. Añade una pantalla más y el objetivo ya toca nav, Home y rutas.
- **Sí:** "volver al vault" apunta a `/games` y la redirección tras `/auth` a `/`. La biblioteca es el "vault" y la Home es el punto de entrada, como en la plantilla.
- **No:** mandar todo a `/games` ni todo a `/`. Cualquiera de las dos deja un destino ilógico para alguno de los botones.
- **Sí:** datos ficticios de actividad en `app/data/activity.ts` con funciones `async`. Mantiene la convención del SPEC 01 de aislar datos ficticios.
- **No:** hardcodearlos dentro de `HomeView`, como hace la plantilla. Dificulta sustituirlos por datos reales.
- **Sí:** portar literalmente los textos de marketing, incluido "12+ JUEGOS" aunque hoy haya 8. Es una decisión explícita de este spec; corregirlo es trabajo de otro.
- **No:** calcular las cifras o retirar afirmaciones no ciertas. No se pidió y cambia el contenido de la plantilla.
- **Sí:** copiar solo las clases `home-*`, de actividad y de precios a `app/globals.css`. Es coherente con el SPEC 01 y no pisa ajustes ya hechos.
- **No:** reemplazar `globals.css` por el `styles.css` de la plantilla, ni crear un `app/home.css` aparte.
- **Sí:** `HomeView` como único componente de cliente de la Home, porque solo necesita el `IntersectionObserver`. `FloatingSilhouettes` y `FeatureIcon` son de servidor.
- **Sí:** botones de navegación como `next/link` con clase `btn`, en lugar del `navigate({ name })` de la plantilla. Mantiene URLs reales y navegación nativa.
- **Sí:** mantener el logo del nav apuntando a `/`.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Las secciones `.reveal` parten con `opacity: 0` y no se ven sin JavaScript o si el observador falla. | El `useEffect` observa todos los `.reveal` al montar y los marca con `.in`. El paso 10 comprueba que todas aparecen al hacer scroll. |
| Navegar a `/` con navegación del cliente no vuelve a ejecutar el observador de otra página. | El `useEffect` está en `HomeView`, que se monta cada vez que se entra en `/`. |
| Al copiar CSS se duplican o se pisan reglas existentes (`.fade-in`, `.btn.xl`, `@keyframes`). | El paso 6 omite lo que ya existe y el paso 10 compara visualmente `/games` con la antigua `/`. |
| Enlaces antiguos a `/` que deberían ir a la biblioteca se quedan sin cambiar. | El paso 3 enumera los tres sitios afectados y los criterios de aceptación los comprueban. |
| `cacheComponents` obliga a tratar de forma explícita los datos asíncronos de `page.tsx`. | El paso 1 revisa la documentación antes de escribir código. |

---

## Qué **no** está en este spec

- La página "Acerca de" ni su enlace en el nav.
- Corrección de cifras o afirmaciones de marketing de la plantilla.
- Datos reales de actividad, ranking o estadísticas.
- Registro real o preselección de la pestaña "crear cuenta" en `/auth`.
- Cambios en la biblioteca más allá de su nueva URL.
- Tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propio spec.
