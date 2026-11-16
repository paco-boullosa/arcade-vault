# SPEC 01 — MVP visual de Arcade Vault

> **Status:** Aprobado
> **Depends on:** Ninguna (parte del scaffold de Next.js y del tema ya portado a `app/globals.css`)
> **Date:** 2026-11-16
> **Objective:** Implementar en Next.js las cinco pantallas de `references/templates/` (biblioteca, detalle, reproductor, acceso y salón de la fama) solo a nivel visual, con datos ficticios y sin ningún juego real.

---

## Por qué existe este spec

Las plantillas de `references/templates/` son un prototipo en React 18 por CDN con Babel, navegación por estado + hash y datos en `window`. Este spec las traslada a la arquitectura real del proyecto (App Router, TypeScript estricto, `cacheComponents`) sin cambiar el diseño. Los datos ficticios se aíslan en `app/data/` para que su futura sustitución por una base de datos no afecte a las pantallas.

---

## Alcance

**Dentro:**

- Cinco pantallas con rutas reales: `/`, `/games/[id]`, `/games/[id]/play`, `/auth`, `/hall-of-fame`.
- `Nav` (con menú móvil) y `Footer` compartidos en `app/layout.tsx`.
- Datos ficticios tipados en `app/data/games.ts` y `app/data/scores.ts`.
- Sesión simulada en `localStorage` (clave `av_user`) para el nav y la fila "Tu mejor marca" del salón.
- Reproductor como maqueta animada: arena placeholder, puntuación que sube sola con un temporizador falso, pausa, fin de partida y modal de puntuación final.
- Guardado de la puntuación final en `localStorage` (clave `av_scores`), solo escritura.
- Estado "sin resultados" en la biblioteca y `notFound()` para ids de juego inexistentes.
- Reutilización de las clases `av-*` y utilidades ya definidas en `app/globals.css`.

**Fuera de alcance (para otros specs):**

- Cualquier juego real o lógica de juego (bucle, colisiones, controles).
- Autenticación real, validación de formularios, OAuth con Google/GitHub (los botones son decorativos).
- Base de datos, API o Server Actions. Las funciones de `app/data/` devuelven datos fijos.
- Lectura de `av_scores` para mostrar las puntuaciones guardadas en el detalle o en el salón.
- Contador de créditos funcional (el texto `CRÉDITOS · 03` es fijo).
- Tests automatizados (no hay runner configurado).
- Internacionalización: toda la interfaz queda en español.

---

## Modelo de datos

```ts
// app/data/games.ts
export type GameColor = "cyan" | "magenta" | "yellow" | "green";
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export type Game = {
  id: string;            // slug, p. ej. "bloque-buster"
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;         // clase CSS de portada, p. ej. "cover-bricks"
  color: GameColor;
  best: number;
  plays: string;         // ya formateado, p. ej. "12.4K"
};

export const CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"] as const;
export async function getGames(): Promise<Game[]>;
export async function getGame(id: string): Promise<Game | undefined>;

// app/data/scores.ts
export type ScoreRow = { rank: number; name: string; score: number; date: string }; // date: "DD/MM/2026"
export async function getScores(gameId: string, count: number): Promise<ScoreRow[]>;
```

```ts
// Sesión simulada (cliente). localStorage["av_user"]
type SessionUser = { name: string } | null;

// Puntuación guardada. localStorage["av_scores"] = SavedScore[]
type SavedScore = { game: string; score: number; name: string; at: number };
```

Convenciones:

- Los 8 juegos y su contenido se portan literalmente desde `references/templates/data.jsx`.
- `getScores` usa el generador pseudoaleatorio con semilla de la plantilla: mismo `gameId`, mismas filas. La semilla es `id.length * 17 + 3` con 10 filas para el detalle y `id.length * 23 + 7` con 12 filas para el salón.
- Los números se formatean con `toLocaleString("es-ES")`.
- `av_user` se lee en un `useEffect`, nunca durante el render, para evitar errores de hidratación.
- Toda lectura y escritura de `localStorage` va dentro de `try/catch`.

---

## Plan de implementación

Cada paso deja la app arrancando con `npm run dev` y es commiteable por separado.

1. **Leer la documentación de Next.js.** Revisar en `node_modules/next/dist/docs/01-app` lo que afecta a este spec: rutas dinámicas con `cacheComponents` (`params`, `generateStaticParams`, `notFound`), `'use client'` y `usePathname`. Ajustar los pasos siguientes si algo contradice este plan. No genera código.
2. **Datos ficticios.** Crear `app/data/games.ts` (tipos, `GAMES`, `CATS`, `getGames`, `getGame`) y `app/data/scores.ts` (`getScores`). Verificar con `npm run lint` y `npx tsc --noEmit`.
3. **Sesión simulada.** Crear `app/components/SessionProvider.tsx` (cliente) con contexto `{ user, login, signOut }` que lee/escribe `av_user`. Envolver `children` en `app/layout.tsx`.
4. **Nav y Footer.** Crear `app/components/Nav.tsx` (cliente, enlaces con `next/link`, estado activo con `usePathname`, panel móvil) y `app/components/Footer.tsx`. Montarlos en `app/layout.tsx` alrededor de `<main className="av-main">`. Ajustar `app/page.tsx` para no duplicar `<main>`.
5. **Biblioteca en `/`.** Crear `app/components/GameCard.tsx` y `app/components/LibraryView.tsx` (cliente: búsqueda, chips de categoría, estado vacío, tilt de la tarjeta). Reescribir `app/page.tsx` como componente de servidor que carga `getGames()` y renderiza la vista. El hero "Empezar" actual desaparece.
6. **Detalle en `/games/[id]`.** Crear `app/games/[id]/page.tsx` (servidor: `getGame`, `getScores(id, 10)`, `notFound()` si no existe) con portada, etiquetas, estadísticas, leaderboard y botones. "JUGAR AHORA" enlaza a `/games/[id]/play` y "VOLVER AL VAULT" a `/`.
7. **Acceso en `/auth`.** Crear `app/auth/page.tsx` y `app/components/AuthForm.tsx` (cliente: pestañas entrar/crear cuenta, campo de correo solo en "crear cuenta"). Al enviar llama a `login({ name })` con el usuario en mayúsculas y máximo 10 caracteres (`PLAYER1` si está vacío) y redirige a `/`. "Jugar como invitado" llama a `signOut()` y redirige a `/`.
8. **Reproductor en `/games/[id]/play`.** Crear `app/games/[id]/play/page.tsx` (servidor, resuelve el juego) y `app/components/GamePlayer.tsx` (cliente: HUD, marco CRT, arena placeholder, temporizador falso cada 220 ms, pausa, fin). "SALIR" vuelve a `/games/[id]`.
9. **Modal de fin de partida.** Dentro de `GamePlayer`, modal con puntuación final, campo de iniciales (máx. 10, mayúsculas), "GUARDAR PUNTUACIÓN" (añade un `SavedScore` a `av_scores` y muestra `▸ PUNTUACIÓN GUARDADA_`), "JUGAR DE NUEVO" y "VOLVER AL VAULT".
10. **Salón de la fama en `/hall-of-fame`.** Crear `app/hall-of-fame/page.tsx` (servidor: carga juegos y 12 filas por juego) y `app/components/HallOfFameView.tsx` (cliente: pestañas por juego, podio 2-1-3, tabla, fila "Tu mejor marca" solo con sesión, botón de volver).
11. **Metadatos y repaso visual.** Añadir `metadata` por ruta (título tipo `Arcade Vault · <pantalla>`), comparar cada pantalla con su plantilla en escritorio y a 375 px de ancho, y retirar código muerto del scaffold.

---

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores.
- [ ] `npm run build` termina sin errores.
- [ ] `/` muestra el hero, el buscador, los 5 chips de categoría y las 8 tarjetas de juego.
- [ ] Escribir `xyz` en el buscador de `/` muestra "NO HAY RESULTADOS" y 0 tarjetas.
- [ ] Pulsar el chip `PUZZLE` deja solo la tarjeta de CAÍDA.
- [ ] Pulsar una tarjeta o su botón "JUGAR" navega a `/games/<id>` de ese juego.
- [ ] `/games/caida` muestra el título, la descripción larga, las 3 estadísticas y 10 filas de leaderboard con las 3 primeras destacadas.
- [ ] `/games/no-existe` muestra la página 404 de Next.js.
- [ ] "JUGAR AHORA" lleva a `/games/<id>/play` y "VOLVER AL VAULT" lleva a `/`.
- [ ] En `/games/<id>/play` la puntuación aumenta sola y deja de aumentar al pulsar PAUSA, con el texto "EN PAUSA" visible.
- [ ] Pulsar FIN abre el modal con la puntuación acumulada.
- [ ] "GUARDAR PUNTUACIÓN" añade un registro a `localStorage["av_scores"]` y muestra "PUNTUACIÓN GUARDADA".
- [ ] "JUGAR DE NUEVO" reinicia puntuación, vidas y nivel y cierra el modal.
- [ ] "SALIR" en el reproductor lleva a `/games/<id>`.
- [ ] En `/auth`, la pestaña "CREAR CUENTA" muestra el campo de correo y la de "INICIAR SESIÓN" lo oculta.
- [ ] Enviar el formulario con usuario `neo` guarda `{"name":"NEO"}` en `localStorage["av_user"]`, redirige a `/` y el nav muestra `NEO ▾`.
- [ ] Pulsar el nombre del usuario en el nav cierra la sesión y el nav vuelve a mostrar "Iniciar Sesión".
- [ ] "JUGAR COMO INVITADO" redirige a `/` sin usuario en `localStorage`.
- [ ] Recargar la página con sesión iniciada mantiene el nombre en el nav sin errores de hidratación en la consola.
- [ ] `/hall-of-fame` muestra 8 pestañas, un podio con el campeón en el centro y una tabla de 12 filas.
- [ ] Cambiar de pestaña en `/hall-of-fame` cambia el podio y la tabla.
- [ ] La fila "TU MEJOR MARCA EN <juego>" aparece solo con sesión iniciada.
- [ ] El enlace activo del nav se resalta en `/` (y en `/games/*`) y en `/hall-of-fame`.
- [ ] A 375 px de ancho aparece el botón hamburguesa, el panel móvil se abre y se cierra y no hay scroll horizontal.
- [ ] La consola del navegador no muestra errores ni avisos de React en ninguna de las cinco rutas.

---

## Decisiones

- **Sí:** rutas reales en inglés (`/games/[id]`, `/games/[id]/play`, `/auth`, `/hall-of-fame`). Dan URLs compartibles y botón atrás nativo. Es el criterio elegido para este proyecto.
- **No:** rutas en español y navegación SPA con hash como en la plantilla. La segunda va contra el App Router.
- **Sí:** carpeta `app/data/` con `games.ts` y `scores.ts`, y funciones `async`. Sustituirlas por consultas a una base de datos no obliga a tocar las pantallas.
- **No:** un único `app/data.ts`. Se queda corto cuando se añadan usuarios o partidas.
- **Sí:** `/` es la biblioteca. Es la pantalla de inicio de las plantillas.
- **No:** conservar el hero "Empezar" del scaffold. No existe en las plantillas.
- **Sí:** sesión simulada en `localStorage`. Reproduce el comportamiento de la plantilla y permite ver la fila "Tu mejor marca".
- **No:** cookie ni sesión en servidor. Sin backend no aportan nada.
- **Sí:** reproductor como maqueta animada con temporizador falso. Deja el hueco claro donde enchufar juegos reales en otro spec.
- **Sí:** componentes en `app/components/` reutilizando las clases `av-*` de `app/globals.css`. El diseño ya está portado y no se reescribe.
- **No:** `components/` en la raíz, ni reescribir los estilos con utilidades Tailwind. Divergiría del diseño de la plantilla.
- **Sí:** componentes de servidor por defecto y `'use client'` solo donde hay estado (`Nav`, `SessionProvider`, `LibraryView`, `AuthForm`, `GamePlayer`, `HallOfFameView`).
- **Sí:** el salón de la fama conserva la fila "Tu mejor marca" con datos derivados, como la plantilla. No lee `av_scores`.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `cacheComponents` exige tratar de forma explícita las rutas dinámicas y los datos asíncronos. | El paso 1 revisa la documentación antes de escribir código y puede ajustar el plan. |
| Errores de hidratación al leer `localStorage` en el primer render. | `SessionProvider` lee `av_user` en `useEffect`. El nav renderiza el estado "sin sesión" hasta que se resuelve. |
| `localStorage` bloqueado (modo privado). | Todos los accesos van en `try/catch`. La app sigue funcionando sin persistir. |
| El temporizador del reproductor sigue activo al salir de la pantalla. | El `setInterval` se limpia en el cleanup del `useEffect`. |
| Las clases de `app/globals.css` se desvían de `references/templates/styles.css`. | El paso 11 compara visualmente cada pantalla con su plantilla. |

---

## Qué **no** está en este spec

- Ningún juego real ni lógica de juego.
- Autenticación real, base de datos o API.
- Lectura de las puntuaciones guardadas en `av_scores`.
- Créditos funcionales.
- Tests automatizados.
- Internacionalización.

Cada uno de estos puntos, si se aborda, va en su propio spec.
