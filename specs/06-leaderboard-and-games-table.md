# SPEC 06 — Tabla de juegos y leaderboard en Supabase

> **Status:** Aprobado
> **Depends on:** SPEC 02, SPEC 04, SPEC 05
> **Date:** 2026-11-19
> **Objective:** Crear las tablas `games` y `scores` en Supabase y sustituir los datos ficticios del catálogo, el detalle de juego, el Salón de la Fama y la actividad de la Home por datos reales, guardando desde `GamePlayer` las puntuaciones de los juegos con motor.

---

## Por qué existe este spec

SPEC 04 dejó la infraestructura de Supabase sin tablas y SPEC 05 dejó las puntuaciones en `localStorage` (`av_scores`), que ninguna pantalla lee. Hoy el catálogo sale de una constante en `app/data/games.ts` y todo el ranking (detalle, Salón, Home) sale de generadores con datos inventados. Este spec conecta las dos mitades: una tabla de juegos como fuente del catálogo y una tabla de puntuaciones que alimenta todos los rankings.

Se pidieron juntos porque comparten esquema (`scores.game_id` apunta a `games.id`) y porque `best` y `plays` del catálogo se derivan de `scores`. Se asume que **no hay autenticación real**: el jugador es un nombre libre, como en el modal actual. Eso implica que cualquiera puede falsear puntuaciones; se acepta de forma consciente y se registra en los riesgos.

La consecuencia visible es que desaparecen las cifras y filas ficticias: un juego sin partidas guardadas muestra 0 partidas, 0 de mejor marca y un estado vacío en sus rankings.

---

## Alcance

**Dentro:**

- Migración SQL versionada en `supabase/migrations/<timestamp>_games_and_scores.sql`, aplicada con `mcp__supabase__apply_migration`, que crea las tablas `games` y `scores`, índices, RLS, tres vistas y el seed de los 9 juegos actuales.
- Tipos generados de la base de datos en `app/lib/supabase/database.types.ts`, y clientes de `app/lib/supabase/` (`client.ts`, `server.ts`, `proxy.ts`) tipados con el genérico `Database`.
- Cliente de lectura sin cookies en `app/lib/supabase/public.ts`, para consultas públicas (incluido `generateStaticParams`).
- `app/data/games.ts` lee `games_with_stats` en lugar de la constante `GAMES`. `Game`, `CATS`, `getGames()` y `getGame(id)` conservan su firma.
- `app/data/scores.ts` lee `game_best_scores` en lugar de `seededScores`. `getScores(gameId, count)` conserva su firma.
- `app/data/activity.ts` lee `scores` y `top_players` en lugar de las constantes. `getRecentScores()` (7 filas) y `getTopPlayers()` (5 filas) conservan su firma.
- `app/lib/format.ts` con `formatPlays` (`0`, `999`, `12.4K`) y `timeAgo` (`hace 2 min`).
- Detalle `/games/[id]`: top 10 real, `Partidas` y `Mejor global` reales, estado vacío.
- Salón de la Fama: pestañas por juego, podio y tabla de 12 filas reales, podio parcial y estado vacío, y fila "TU MEJOR MARCA" con rango y puntuación reales del jugador de la sesión.
- Home: "Actividad en vivo" con las 7 últimas puntuaciones y el top 5 de jugadores reales, con estado vacío.
- `GamePlayer`: guardado con `insert` en `scores` mediante el cliente de navegador, con estados `guardando` y `error` y reintento. Solo para juegos con motor (`ENGINES[game.id]`).
- Juegos sin motor: el modal de fin de partida no ofrece guardar y muestra un aviso de demo.
- Se deja de escribir `localStorage.av_scores`.
- Lectura dinámica por petición bajo `<Suspense>`, sin caché de datos.

**Fuera de alcance (para otros specs):**

- Autenticación real, tabla `profiles`, nombres de jugador únicos y reservados. El jugador sigue siendo un texto libre.
- Evitar puntuaciones falsas: rate limit, Server Action de guardado, columna `max_score` por juego y triggers de validación.
- Realtime (actualizar rankings sin recargar).
- Caché con `use cache`, `cacheTag` y `revalidateTag`.
- Identificar "tu mejor marca" por id de dispositivo. Se identifica por nombre de sesión.
- Migrar las puntuaciones que ya estén en `localStorage.av_scores`.
- Paginación del ranking, borrado o moderación de puntuaciones.
- Panel o formulario para administrar la tabla `games`.
- Motores reales para los 8 juegos simulados y sus puntuaciones.
- Corregir las cifras de marketing de la Home ("12+ JUEGOS", "MILES DE PARTIDAS"), que siguen literales (SPEC 02).
- Supabase local con CLI y Docker, y tests automatizados (no hay runner configurado).

---

## Modelo de datos

Esquema de la migración (resumen; el SQL completo se escribe en el paso 2):

```sql
create table public.games (
  id         text primary key,                  -- 'asteroids', 'bloque-buster', ...
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover      text not null,                     -- clase CSS, p. ej. 'cover-asteroids'
  color      text not null check (color in ('cyan','magenta','yellow','green')),
  sort_order integer not null unique            -- orden del catálogo
);

create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null references public.games(id),
  player_name text not null
    check (char_length(player_name) between 1 and 16 and player_name = btrim(player_name)),
  score       integer not null check (score between 0 and 9999999),
  created_at  timestamptz not null default now()
);
-- índices: scores (game_id, score desc, created_at), scores (created_at desc)
```

Vistas, todas con `security_invoker = true` para que apliquen la RLS de `scores`:

```sql
-- games.* + best (máximo, 0 si no hay) + plays (recuento de filas de scores)
create view public.games_with_stats ...;
-- mejor puntuación de cada player_name en cada juego (distinct on (game_id, player_name))
create view public.game_best_scores ...;   -- game_id, player_name, score, created_at
-- mejor puntuación individual de cada player_name en cualquier juego
create view public.top_players ...;        -- player_name, score
```

Permisos y RLS:

- RLS activada en `games` y `scores`.
- `games`: política `select` para `anon` y `authenticated`. Sin políticas de escritura.
- `scores`: política `select` y política `insert` (`with check (true)`, la validación está en los `CHECK`) para `anon` y `authenticated`. Sin `update` ni `delete`.
- `grant select` sobre las tres vistas a `anon` y `authenticated`. Se revocan al resto de roles de API los privilegios de escritura sobre `games`.

Tipos de la aplicación (las formas existentes se conservan):

```ts
// app/data/games.ts — sin cambios de forma
export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: GameColor;
  best: number; // ahora derivado de scores
  plays: string; // ahora derivado de scores, formateado con formatPlays
};

// app/data/scores.ts
export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string;
}; // date "DD/MM/YYYY"
export type PlayerBest = { rank: number; score: number; date: string };

// app/lib/scores.ts (cliente de navegador, lo usa HallOfFameView)
export async function fetchPlayerBest(
  supabase: SupabaseClient<Database>,
  gameId: string,
  name: string,
): Promise<PlayerBest | null>;

// inserción desde GamePlayer
type NewScore = { game_id: string; player_name: string; score: number };
```

Convenciones:

- Una fila por jugador en el ranking de cada juego: su mejor marca (`game_best_scores`). Empates: gana la más antigua (`created_at asc`).
- `rank` se calcula en la aplicación como posición en la lista ordenada. Para "tu mejor marca" es `1 +` el número de filas de `game_best_scores` del juego con puntuación mayor que la tuya.
- Los nombres se comparan exactos y sensibles a mayúsculas (`Ana` y `ANA` son jugadores distintos).
- `Partidas` (`plays`) cuenta solo las puntuaciones guardadas, no las partidas jugadas.
- `getGames()` ordena por `sort_order`, que reproduce el orden actual de `GAMES` (los 8 originales y `asteroids` al final). La Home sigue usando `games.slice(0, 6)`.
- Las fechas se formatean en servidor como `DD/MM/YYYY` (`es-ES`) y `timeAgo` en servidor, para no provocar desajustes de hidratación.
- Los datos públicos se leen con `app/lib/supabase/public.ts`: `createClient` de `@supabase/supabase-js` con las dos variables `NEXT_PUBLIC_*`, `persistSession: false` y sin `cookies()`.
- Nunca se usa la `service_role` key en código. El MCP de Supabase solo se usa para aplicar la migración y comprobar.

---

## Plan de implementación

Cada paso deja la app arrancando con `npm run dev` y es commiteable por separado.

1. **Leer la documentación.** Revisar en `node_modules/next/dist/docs/01-app` lo que afecta a este spec: acceso a datos no cacheados bajo `cacheComponents` (obligación de `<Suspense>`), `generateStaticParams` con datos remotos y Client Components con consultas en `useEffect`. Revisar con `mcp__supabase__search_docs` `security_invoker` en vistas, `distinct on` y privilegios de `anon`. Ajustar los pasos siguientes si algo contradice este plan. No genera código.
2. **Migración.** Escribir `supabase/migrations/<timestamp>_games_and_scores.sql` con tablas, `CHECK`, índices, RLS, políticas, `grant`, las tres vistas y el `insert` de los 9 juegos (ids, textos, `cat`, `cover`, `color` y `sort_order` tomados de `app/data/games.ts`). Aplicarla con `mcp__supabase__apply_migration`. Comprobar con `list_tables` y `get_advisors` (seguridad), y con `execute_sql` que las inserciones válidas pasan y las inválidas (nombre vacío, de 17 caracteres o con espacios en los extremos, `score` negativo o de 10.000.000, `game_id` inexistente) fallan. Borrar las filas de prueba al terminar.
3. **Tipos y clientes.** Generar `app/lib/supabase/database.types.ts` con `mcp__supabase__generate_typescript_types`. Añadir el genérico `Database` a `client.ts`, `server.ts` y `proxy.ts`. Crear `app/lib/supabase/public.ts`. Verificar con `npx tsc --noEmit`.
4. **Formato.** Crear `app/lib/format.ts` con `formatPlays` y `timeAgo`. Verificar con `npx tsc --noEmit`.
5. **Catálogo desde la base de datos.** Reescribir `getGames()` y `getGame(id)` en `app/data/games.ts` para leer `games_with_stats` con `public.ts` y convertir `plays` con `formatPlays`. Eliminar la constante `GAMES`. Envolver en `<Suspense>` lo que haga falta en `app/page.tsx` y `app/games/page.tsx`. Con `npm run dev`, `/games` muestra 9 tarjetas con `0` de mejor marca y `0` partidas, y `/` muestra las 6 primeras.
6. **Ranking del detalle.** Reescribir `getScores(gameId, count)` en `app/data/scores.ts` para leer `game_best_scores` (orden `score desc, created_at asc`, límite `count`) y eliminar `seededScores` y `PLAYERS`. En `app/games/[id]/page.tsx` mostrar el estado vacío `AÚN NO HAY PUNTUACIONES` cuando no hay filas. Con `npm run dev`, `/games/<id>` carga para los 9 juegos.
7. **Salón de la Fama.** En `app/hall-of-fame/page.tsx` envolver la carga en `<Suspense>`. En `HallOfFameView.tsx` soportar menos de 3 filas en el podio (hueco con `—`), estado vacío sin podio ni tabla, y retirar de momento el bloque de la fila `you` inventada. Con `npm run dev`, `/hall-of-fame` carga sin errores para los 9 juegos.
8. **Tu mejor marca.** Crear `app/lib/scores.ts` con `fetchPlayerBest`. En `HallOfFameView.tsx` consultar con el cliente de navegador, dentro de un `useEffect` y cuando cambien la pestaña o el usuario, y mostrar la fila con rango, nombre, puntuación y fecha reales. Sin sesión no se muestra nada. Con sesión pero sin marca, se muestra `AÚN NO TIENES MARCA EN <JUEGO>`.
9. **Actividad de la Home.** Reescribir `getRecentScores()` (7 últimas filas de `scores` con `games(title, color)` y `timeAgo`) y `getTopPlayers()` (5 filas de `top_players` por `score desc, player_name asc`) en `app/data/activity.ts`. Añadir en `HomeView.tsx` el estado vacío de cada lista. Con `npm run dev`, `/` carga con las dos listas vacías.
10. **Guardar la puntuación.** En `GamePlayer.tsx`: sustituir el cuerpo de `saveScore` por un `insert` asíncrono en `scores` con el cliente de navegador, con estados `guardando` (botón deshabilitado) y `error` (mensaje y reintento), y marcar `saved` solo si no hay error. Limitar el campo de nombre a 16 caracteres, aplicar `trim()` y deshabilitar el guardado con el nombre vacío. Para juegos sin `ENGINES[game.id]`, no mostrar el botón de guardar y mostrar `ESTE JUEGO ES UNA DEMO: LA PUNTUACIÓN NO SE GUARDA`. Eliminar `SavedScore` y toda referencia a `av_scores`.
11. **Repaso.** Ejecutar `npm run lint`, `npx tsc --noEmit` y `npm run build`. Jugar una partida completa de Asteroides, guardarla y comprobarla en `/games/asteroids`, `/hall-of-fame`, `/` y `/games`. Revisar la consola, `get_advisors`, `git diff` (sin claves) y retirar código muerto.

---

## Criterios de aceptación

**Base de datos**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] Existe `supabase/migrations/<timestamp>_games_and_scores.sql` y `mcp__supabase__list_migrations` lo lista como aplicado.
- [ ] `list_tables` muestra `games` y `scores` con RLS activada.
- [ ] `games` contiene exactamente 9 filas con los ids actuales (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`, `asteroids`) y `sort_order` del 1 al 9 en ese orden.
- [ ] Como `anon`, `select` sobre `games`, `scores` y las tres vistas funciona.
- [ ] Como `anon`, `insert`, `update` y `delete` sobre `games` fallan, y `update` y `delete` sobre `scores` fallan.
- [ ] Como `anon`, un `insert` válido en `scores` funciona, y cada uno de estos falla: nombre vacío, nombre de 17 caracteres, nombre con espacios en los extremos, `score` de -1, `score` de 10.000.000 y `game_id` inexistente.
- [ ] `get_advisors` (seguridad) no reporta errores sobre `games`, `scores` ni las vistas.
- [ ] Tras las pruebas, `scores` no contiene filas de prueba.

**Catálogo y detalle**

- [ ] Con `scores` vacía, `/games` muestra 9 tarjetas, todas con mejor marca `0` y `0` partidas, en el orden de `sort_order`.
- [ ] `/` muestra como mini-tarjetas los 6 primeros juegos de `sort_order`.
- [ ] `/games/<id>` carga para los 9 juegos y muestra `AÚN NO HAY PUNTUACIONES` cuando el juego no tiene filas.
- [ ] Tras guardar una puntuación de Asteroides, `/games/asteroids` la muestra en `#01` con nombre, puntuación y fecha `DD/MM/YYYY`, `Partidas` vale `1` y `Mejor global` vale esa puntuación.
- [ ] Tras guardar una segunda puntuación menor con el mismo nombre, el ranking sigue mostrando una sola fila para ese nombre con la mejor marca y `Partidas` vale `2`.
- [ ] La tarjeta ASTEROIDES de `/games` muestra la mejor marca real.

**Salón de la Fama**

- [ ] `/hall-of-fame` muestra una pestaña por cada uno de los 9 juegos y cargar cualquiera no produce errores en consola.
- [ ] Una pestaña sin puntuaciones muestra `AÚN NO HAY PUNTUACIONES` y no muestra podio ni tabla.
- [ ] Una pestaña con 1 o 2 puntuaciones muestra el podio con `—` en los puestos vacíos, sin errores.
- [ ] Una pestaña con más de 12 jugadores muestra solo 12 filas, ordenadas por puntuación descendente.
- [ ] Con sesión cuyo nombre coincide con un jugador de ese juego, aparece "TU MEJOR MARCA" con su mejor puntuación y su rango real.
- [ ] Con sesión sin puntuaciones en ese juego aparece `AÚN NO TIENES MARCA EN <JUEGO>`.
- [ ] Sin sesión no aparece la fila "TU MEJOR MARCA".

**Home**

- [ ] Con `scores` vacía, "ACTIVIDAD EN VIVO" muestra el estado vacío en ambas listas.
- [ ] Con puntuaciones guardadas, las últimas puntuaciones muestran como máximo 7 filas, la más reciente primero, con el título del juego y `hace N min` (o equivalente).
- [ ] El top de jugadores muestra como máximo 5 filas, con la mejor puntuación individual de cada nombre en cualquier juego.

**Guardado**

- [ ] Al terminar una partida de Asteroides y pulsar GUARDAR PUNTUACIÓN, `scores` recibe una fila con `game_id = 'asteroids'`, el nombre del modal y la puntuación mostrada.
- [ ] Mientras dura el guardado el botón está deshabilitado, y un doble clic crea una sola fila.
- [ ] El campo de nombre admite como máximo 16 caracteres y GUARDAR PUNTUACIÓN está deshabilitado con el nombre vacío o solo con espacios.
- [ ] Con la petición bloqueada, el modal muestra un mensaje de error, no marca la puntuación como guardada y permite reintentar.
- [ ] En un juego sin motor (por ejemplo `/games/rocas/play`), al terminar el modal no muestra GUARDAR PUNTUACIÓN, muestra `ESTE JUEGO ES UNA DEMO: LA PUNTUACIÓN NO SE GUARDA` y no se envía ningún `insert` a `scores`.
- [ ] Una búsqueda de `av_scores` en `app/` no da resultados.

**Calidad**

- [ ] `app/data/scores.ts` no contiene `seededScores` ni `PLAYERS`, y `app/data/games.ts` y `app/data/activity.ts` no contienen datos fijos de juegos ni de puntuaciones.
- [ ] Una búsqueda de `service_role` en `app/`, `proxy.ts` y `scripts/` no da resultados.
- [ ] `git diff` no contiene la publishable key ni `SUPABASE_DB_PASS`.
- [ ] `app/components/SessionProvider.tsx` no tiene cambios.
- [ ] La consola del navegador no muestra errores ni avisos de React en `/`, `/games`, `/games/asteroids`, `/games/asteroids/play` ni `/hall-of-fame`.
- [ ] A 375 px de ancho, `/` y `/hall-of-fame` no tienen scroll horizontal.

---

## Decisiones

- **Sí:** un único spec para tabla de juegos y leaderboard. Se pidieron juntos y comparten esquema y migración. Si el trabajo crece, el guardado desde `GamePlayer` es lo más fácil de separar.
- **Sí:** nombre libre sin autenticación, `INSERT` anónimo con RLS. Encaja con el `SessionProvider` simulado y deja la autenticación real para su spec. **No:** exigir login ni usar `signInAnonymously`, porque retrasan el leaderboard y añaden sesiones que gestionar.
- **Sí:** `CHECK` en la base de datos (nombre 1–16 sin espacios en los extremos, `score` 0–9.999.999) y clave foránea a `games`. Frena la basura obvia y no depende del cliente. **No:** `max_score` por juego con trigger, porque habría que fijar un máximo por juego y los 8 simulados no tienen reglas reales. **No:** dejarlo sin límites, porque permitiría nombres enormes.
- **Sí:** `games` guarda solo metadatos y `best` y `plays` se derivan de `scores` en la vista `games_with_stats`. Nunca quedan desactualizados. **No:** sembrar las cifras ficticias (`best: 28450`, `plays: "12.4K"`) como columnas, porque no se actualizarían y mezclarían datos falsos con reales. Las cifras ficticias desaparecen.
- **Sí:** estado vacío cuando no hay puntuaciones. Todo lo visible es real. **No:** sembrar filas falsas en `scores`, porque mezclarlas con las reales obliga a marcarlas y borrarlas después.
- **Sí:** los juegos sin motor no guardan puntuación y muestran un aviso de demo. Sus puntos son aleatorios y contaminarían el ranking real. **No:** permitir guardarlos, ni ocultarlos del Salón: la pestaña existe y muestra el estado vacío, que es información verdadera.
- **Sí:** una fila por jugador (su mejor marca) en detalle y Salón. Un solo jugador no llena el top 10, y es coherente con los datos ficticios anteriores, que tenían nombres únicos. **No:** mostrar todas las partidas. Esto no se discutió expresamente y queda sujeto a revisión.
- **Sí:** nombres sensibles a mayúsculas y comparación exacta. Es la regla más simple y coincide con cómo se buscan en "tu mejor marca". **No:** normalizar a minúsculas, porque esconde al jugador su propio nombre tal como lo escribió.
- **Sí:** top de jugadores de la Home = mejor puntuación individual por nombre en cualquier juego. **No:** sumar las mejores marcas por juego, porque mezcla escalas de puntuación y favorece a quien prueba más juegos. Es una vista (`top_players`) y la Home no agrega nada en el cliente.
- **Sí:** "tu mejor marca" por nombre de sesión (`av_user`). Sin sesión no se muestra. **No:** `device_id` en `localStorage`, porque añade una columna y se pierde al limpiar el navegador. Aceptado: un homónimo se confunde con el jugador.
- **Sí:** vistas con `security_invoker = true`. Aplican la RLS de `scores` y no saltan los permisos del que las crea. **No:** funciones RPC ni agregados calculados en el cliente.
- **Sí:** el guardado se hace con el cliente de navegador directo contra `scores`, sin fallback. Si falla, el modal lo muestra y deja reintentar. **No:** Server Action, porque añade piezas y no cambia el modelo de seguridad (usa la misma clave). **No:** copia local en `av_scores`, porque nadie la lee. Aceptado: se pierde la puntuación si el jugador sale tras un fallo.
- **Sí:** dejar de escribir `av_scores` y no migrar lo ya guardado. **No:** conservar las puntuaciones locales anteriores, porque SPEC 05 las dejó como solución provisional y las partidas de prueba no tienen valor.
- **Sí:** lectura dinámica por petición bajo `<Suspense>`. Siempre actual y sin invalidaciones. **No:** `use cache` con `revalidateTag`, porque exige Server Action para invalidar. **No:** Realtime, porque es un dominio propio.
- **Sí:** un cliente de lectura sin cookies (`public.ts`). Los datos son públicos y `generateStaticParams` no puede usar `cookies()`. **No:** reutilizar `server.ts`, que fuerza renderizado dinámico y falla fuera de una petición.
- **Sí:** genérico `Database` y `database.types.ts` generado. SPEC 04 los aplazó porque no había tablas. **No:** tipos a mano, porque se desincronizan del esquema.
- **Sí:** SQL versionado en `supabase/migrations/` y aplicado por MCP. Deja trazabilidad sin CLI ni Docker. **No:** solo MCP, porque el repo no reflejaría el esquema.
- **Sí:** `sort_order` explícito y los ids actuales como clave. Conserva el orden del catálogo y las URLs `/games/<id>`.
- **Sí:** conservar las firmas de `getGames`, `getGame`, `getScores`, `getRecentScores` y `getTopPlayers`. Los componentes cambian solo en los estados vacíos y en el guardado.
- **Sí:** el título del juego en "últimas puntuaciones" pasa a mayúsculas (`CAÍDA`) porque sale de `games.title`. Antes era el texto literal de la plantilla (`Caída`).
- **Sí:** la pestaña inicial del Salón sigue siendo el primer juego del catálogo, aunque esté vacío. **No:** elegir el primer juego con datos, porque no se pidió y cambia el comportamiento.
- **Sí:** `Partidas` cuenta solo puntuaciones guardadas. No hay otro registro de partidas jugadas. El rótulo no cambia.

---

## Riesgos

| Riesgo                                                                                                        | Mitigación                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cualquiera puede insertar puntuaciones falsas con la clave publishable, y la tabla puede inflarse con basura. | Aceptado en este spec. Los `CHECK` limitan el rango y la longitud. La defensa real (autenticación, rate limit, validación por juego) va en otro spec. |
| `cacheComponents` rompe el build si se leen datos no cacheados fuera de `<Suspense>`.                         | El paso 1 revisa la documentación y los pasos 5, 7 y 9 envuelven las páginas. El criterio de `npm run build` lo comprueba.                            |
| `generateStaticParams` consulta Supabase durante el build, y el build falla si no hay red o variables.        | Usa `public.ts`, que no depende de cookies. Se documenta que el build necesita `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.   |
| Una vista creada con permisos de propietario se salta la RLS.                                                 | `security_invoker = true` y revisión con `get_advisors` en el paso 2 y en el repaso.                                                                  |
| Dos jugadores con el mismo nombre comparten "tu mejor marca", y quien cambia de nombre pierde la suya.        | Aceptado y registrado en las decisiones. El nombre único llega con la autenticación real.                                                             |
| Un fallo de red al guardar descarta la puntuación sin copia local.                                            | El modal muestra el error y permite reintentar mientras siga abierto. Aceptado el caso de salir de la página.                                         |
| `HallOfFameView` asume 12 filas (`rows[0..2]` y `rows[5]`) y se rompe con menos o con ninguna.                | El paso 7 soporta podio parcial y estado vacío, y el criterio de aceptación prueba pestañas con 0, 1 y 2 filas.                                       |
| `Partidas` subestima el uso real porque solo cuenta partidas guardadas.                                       | Se documenta en el modelo de datos. Un contador de partidas jugadas, si hace falta, va en otro spec.                                                  |
| El orden del catálogo cambia y rompe la Home (`slice(0, 6)`).                                                 | `sort_order` reproduce el orden actual y un criterio de aceptación lo comprueba.                                                                      |
| Los criterios de SPEC 05 sobre `av_scores` quedan obsoletos.                                                  | Este spec los sustituye: ya no se escribe `av_scores`. No se modifican los specs anteriores.                                                          |

---

## Qué **no** está en este spec

- Autenticación real, `profiles` y nombres de jugador únicos.
- Protección contra puntuaciones falsas (rate limit, Server Action, `max_score`, triggers).
- Realtime y caché con `use cache`.
- "Tu mejor marca" por id de dispositivo.
- Migración de `localStorage.av_scores`.
- Paginación, borrado y moderación de puntuaciones.
- Administración de la tabla `games`.
- Motores reales para los 8 juegos simulados.
- Corrección de las cifras de marketing de la Home.
- Supabase local con CLI y Docker, y tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propio spec.
