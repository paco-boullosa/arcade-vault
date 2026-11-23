# SPEC 13 — Registro, login y autenticación con Supabase Auth

> **Status:** Implementada
> **Depends on:** SPEC 01, SPEC 04, SPEC 06
> **Date:** 2026-11-23
> **Objective:** Sustituir la sesión simulada en `localStorage` por autenticación real con Supabase Auth (registro y login con email y contraseña, Google y GitHub, confirmación de correo obligatoria, recuperación de contraseña y cierre de sesión), de modo que las puntuaciones guardadas con sesión queden ligadas a la cuenta mediante un `scores.user_id` opcional.

---

## Por qué existe este spec

La pantalla `/auth` (`app/components/AuthForm.tsx`) es hoy una maqueta de SPEC 01: pestañas INICIAR SESIÓN y CREAR CUENTA, botón de invitado y botones GOOGLE y GITHUB que no hacen nada. El botón de enviar llama a `login({ name })` y `SessionProvider` guarda `{ name }` en `localStorage` (`av_user`), así que cualquiera "entra" con cualquier nombre sin contraseña y sin cuenta. Eso es suficiente para una maqueta y no para un ranking: nada impide escribir el nombre de otro jugador.

La infraestructura ya está preparada por SPEC 04: `app/lib/supabase/{client,server,proxy}.ts` existen y el `proxy.ts` raíz llama a `getClaims()` en cada petición para refrescar la sesión. Falta lo que va por encima: formularios reales, rutas de retorno de correo y OAuth, un `SessionProvider` alimentado por Supabase y la relación entre cuenta y puntuaciones.

El usuario ha decidido (y no quiere reabrir):

- **Métodos:** email y contraseña, y OAuth con Google y GitHub. Sin magic link.
- **Confirmación de correo obligatoria:** no hay sesión hasta pulsar el enlace del correo.
- **Recuperación de contraseña incluida** en esta spec.
- **Nombre de jugador en `user_metadata.username`**, sin tabla `profiles`. Es único; no se puede repetir nombre.
- **`scores.user_id` opcional:** con sesión se guarda con el `user_id`; el invitado sigue pudiendo guardar sin él.
- **El modo invitado se mantiene** (botón JUGAR COMO INVITADO).
- **Tras entrar se vuelve a donde se estaba** (`?next=` validado, por defecto `/`).
- **Nombre en OAuth derivado del proveedor**, sin paso extra; editarlo queda para otra spec.

---

## Alcance

**Dentro:**

- Registro con usuario, correo y contraseña (`signUp`), con estado "Revisa tu correo" y botón de reenviar el correo de confirmación.
- Login con correo y contraseña (`signInWithPassword`).
- Login con Google y GitHub (`signInWithOAuth`).
- Recuperación de contraseña: enlace "¿Olvidaste tu contraseña?" en el login, envío de correo y pantalla `/auth/reset` para fijar la nueva.
- Ruta `app/auth/callback/route.ts` que intercambia el `code` por sesión (confirmación de correo, OAuth y recuperación) y redirige a `next`.
- `SessionProvider` leyendo la sesión de Supabase y manteniendo la API `useSession()`; `signOut()` real; limpieza de la clave `av_user` heredada.
- Nav con el nombre del jugador y botón de cerrar sesión (escritorio y panel móvil).
- Migración: `scores.user_id uuid` nullable, referencia a `auth.users`, índice y política de insert que impide atribuir una puntuación a otra cuenta. Regeneración de `database.types.ts`.
- `GamePlayer`: con sesión, guarda con `user_id` y el nombre de la cuenta (campo de solo lectura); sin sesión, como hasta ahora.
- Mensajes de error en español para los códigos de error de Supabase Auth más comunes.
- Configuración de Supabase Auth documentada en el spec y aplicada a mano en el panel (confirmación de correo, Site URL, Redirect URLs, proveedores).
- Diseño de las pantallas con `/frontend-design`, reutilizando las clases `.auth-*` y `.field` existentes.
- Actualizar `CLAUDE.md` (la sesión ya no es solo local).

**Fuera de alcance (para otros specs):**

- Tabla `profiles`, unicidad de usernames y cambio de nombre de usuario.
- Magic link, teléfono/SMS, MFA y más proveedores OAuth.
- Proteger rutas: todas las páginas siguen siendo públicas; guardar puntuación sigue sin exigir cuenta.
- Cerrar el insert público de `scores` a invitados.
- Asociar a una cuenta las puntuaciones de invitado previas (las filas antiguas conservan `user_id = null`).
- Perfil, avatar, página "Mi cuenta", cambio de correo o de contraseña con sesión iniciada, borrar cuenta.
- SMTP propio (Resend) para los correos de Auth: se usa el SMTP integrado de Supabase.
- Panel de administración y roles.
- Tests automatizados (no hay runner).

---

## Modelo de datos

### Base de datos

Migración nueva `supabase/migrations/YYYYMMDDHHMMSS_scores_user_id.sql` (nunca se edita una migración aplicada):

```sql
alter table public.scores
  add column user_id uuid references auth.users (id) on delete set null;

create index scores_user_id_idx on public.scores (user_id);

-- Cualquiera puede insertar, pero un user_id solo puede ser el propio.
drop policy "scores_insert_public" on public.scores;

create policy "scores_insert_own_or_guest"
  on public.scores for insert
  to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));
```

- `on delete set null`: borrar una cuenta no borra el ranking, la puntuación queda como anónima.
- `(select auth.uid())` evita reevaluar la función por fila.
- Los grants de `scores` no cambian (`select, insert` para `anon` y `authenticated`). `anon` puede insertar solo con `user_id` nulo porque `auth.uid()` es nulo para él.
- Las vistas `game_best_scores`, `top_players` y `games_with_stats` agrupan por `player_name` y **no cambian**; no se expone `user_id` en ellas.
- Hay que regenerar `app/lib/supabase/database.types.ts` con el MCP de Supabase.

### Tipos de la app

```ts
// app/components/SessionProvider.tsx
export type SessionUser = { id: string; name: string } | null; // antes: { name: string }

type SessionActions = {
  signOut: () => Promise<void>; // `login` desaparece: ya no hay sesión simulada
};
```

`useSession()` sigue devolviendo `{ user, signOut }`; `HallOfFameView` y `GamePlayer` solo leen `user.name` y no cambian de contrato.

### Reglas del nombre de jugador (`app/lib/auth/username.ts`, funciones puras)

```ts
export const USERNAME_RE = /^[A-Z0-9_]{3,10}$/;
export function normalizeUsername(raw: string): string; // trim, mayúsculas, quita caracteres fuera de [A-Z0-9_], corta a 10
export function isValidUsername(value: string): boolean; // USERNAME_RE.test(value)
export function deriveUsername(
  meta: Record<string, unknown>,
  email?: string | null,
): string;
```

- Se guarda en mayúsculas, como el `PLAYER1` actual, y cabe de sobra en `scores.player_name` (1–16).
- `deriveUsername` (para OAuth): toma `user_name`, `preferred_username`, `name` o la parte local del correo, por ese orden, lo normaliza y, si queda con menos de 3 caracteres, usa `JUGADOR` más 3 dígitos tomados del `id` o del correo.
- En el registro con email, el usuario escribe el username y se valida con `isValidUsername`; se envía en `options.data.username`.
- El nombre mostrado sale de `user.user_metadata.username`; si falta (cuenta antigua o OAuth aún sin persistir) se usa `deriveUsername`.

### Contrato de URLs

| Ruta                                  | Quién la llama                               | Efecto                                                                   |
| ------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| `/auth?next=<ruta>`                   | Nav, `GamePlayer` y enlaces                  | Formulario; tras entrar va a `next` (por defecto `/`)                    |
| `/auth?error=<código>`                | `callback` cuando falla                      | Muestra un aviso en español sobre el formulario                          |
| `/auth/callback?code=...&next=<ruta>` | Correo de confirmación, OAuth y recuperación | Intercambia el código, persiste el username si falta y redirige a `next` |
| `/auth/reset`                         | `callback` tras el correo de recuperación    | Formulario de nueva contraseña (exige sesión de recuperación)            |

`next` solo se acepta si empieza por `/` y no por `//` ni `/\` (helper `safeNext` en `app/lib/auth/redirect.ts`); en otro caso, `/`. Evita el _open redirect_.

Textos de error (mapa por `error.code` de Supabase, con un genérico por defecto): `invalid_credentials` → "Correo o contraseña incorrectos"; `email_not_confirmed` → "Confirma tu correo antes de entrar" (con botón de reenviar); `weak_password` → "La contraseña es demasiado débil"; `over_email_send_rate_limit` → "Demasiados correos enviados, espera unos minutos"; `provider_disabled` → "Este método de acceso no está disponible"; por defecto → "No se pudo completar la operación. Inténtalo de nuevo".

Reglas del formulario: contraseña de 8 caracteres como mínimo (cliente y configuración de Supabase); correo con `type="email"`; el login pide **correo** y contraseña (no usuario), porque Supabase Auth no inicia sesión por username sin tabla propia.

### Configuración de Supabase Auth (manual, panel)

- Confirmación de correo: **activada** ("Confirm email").
- Site URL: la URL de producción; Redirect URLs: `http://localhost:3000/auth/callback` y la de producción.
- Proveedores Google y GitHub: habilitados con `client_id` y `secret` de cada app OAuth; la URL de retorno que dan Google y GitHub es la de Supabase (`https://<ref>.supabase.co/auth/v1/callback`).
- Longitud mínima de contraseña: 8.
- No hay variables de entorno nuevas: se usan `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ya existentes. Los secretos OAuth viven en el panel, nunca en el repo.

---

## Plan de implementación

1. **Leer la documentación.** Las guías de `node_modules/next/dist/docs/01-app` sobre route handlers, `proxy` y `cacheComponents`; la guía de Supabase Auth con `@supabase/ssr` para Next.js (PKCE, `exchangeCodeForSession`) con `mcp__supabase__search_docs`; `app/lib/supabase/{client,server}.ts` y `app/components/{SessionProvider,Nav,GamePlayer,HallOfFameView}.tsx`. No genera código.
2. **Migración de `scores`.** `YYYYMMDDHHMMSS_scores_user_id.sql` aplicada con `mcp__supabase__apply_migration`, `database.types.ts` regenerado con `mcp__supabase__generate_typescript_types` y `mcp__supabase__get_advisors`. Manual: `npx tsc --noEmit` sin errores, el número de filas de `scores` no cambia, un insert con `user_id` nulo funciona como `anon`, y la app y el ranking siguen igual.
3. **Configuración de Auth en el panel.** Confirmación de correo, Site URL, Redirect URLs, longitud de contraseña y proveedores, según la sección anterior. Manual: el usuario lo marca como hecho; los proveedores pueden quedar para el paso 8 si aún no tiene las apps OAuth.
4. **Helpers puros.** `app/lib/auth/username.ts` (`normalizeUsername`, `isValidUsername`, `deriveUsername`), `app/lib/auth/redirect.ts` (`safeNext`) y `app/lib/auth/errors.ts` (mapa de códigos a texto). Manual: `npx tsc --noEmit` y un script temporal con `tsx` (fuera de `app/`, se borra) que imprime casos: `safeNext("//evil.com")` → `/`, `safeNext("/games/snake/play")` → igual, `deriveUsername({ name: "Ana López" })` → `ANALPEZ`, `deriveUsername({}, "a@b.c")` → `JUGADORxxx`.
5. **Ruta de retorno.** `app/auth/callback/route.ts` (GET): con `code`, `exchangeCodeForSession`; si el usuario no tiene `user_metadata.username`, lo guarda con `updateUser({ data: { username: deriveUsername(...) } })`; redirige a `safeNext(next)`. Sin `code` o con error, redirige a `/auth?error=callback`. Manual: `/auth/callback` sin parámetros redirige a `/auth?error=callback` y no lanza 500.
6. **Sesión real.** `SessionProvider` con el cliente de `app/lib/supabase/client.ts`: lee la sesión inicial, se suscribe a `onAuthStateChange` y alimenta el store externo manteniendo el patrón `useSyncExternalStore` con `getServerSnapshot` sin sesión (para no romper la hidratación bajo `<Suspense>`); `signOut()` llama a `supabase.auth.signOut()`; elimina `av_user` de `localStorage` al montar. Se quita `login` y, en el mismo paso, `AuthForm` deja de llamarlo (queda solo con JUGAR COMO INVITADO). Manual: `npx tsc --noEmit`, `npm run lint`, la app arranca sin errores de hidratación y el Nav muestra "Iniciar Sesión".
7. **Registro y login con email.** `AuthForm.tsx` con las dos pestañas reales: registro (usuario, correo, contraseña) con `signUp` y `emailRedirectTo` al callback, estado "Revisa tu correo" con REENVIAR (`resend`, enfriamiento de 60 s), y login con `signInWithPassword`; estados de carga y de error con el mapa del paso 4; redirección a `safeNext(next)` al haber sesión (también si se abre `/auth` ya con sesión). Diseño con `/frontend-design`. Manual: registrar una cuenta de prueba, ver "Revisa tu correo", confirmar con el enlace, volver con sesión y el nombre en el Nav.
8. **OAuth.** Los botones GOOGLE y GITHUB llaman a `signInWithOAuth` con `redirectTo` al callback (con `next`); deshabilitados y con aviso mientras la petición está en curso; `provider_disabled` muestra el mensaje. Manual: entrar con Google y con GitHub (si ya están configurados en el paso 3), con el username derivado en el Nav.
9. **Recuperación de contraseña.** Enlace "¿Olvidaste tu contraseña?" en la pestaña de login que muestra un formulario de correo (`resetPasswordForEmail` con `redirectTo` al callback con `next=/auth/reset`); `app/auth/reset/page.tsx` y `app/components/ResetPasswordForm.tsx` con nueva contraseña y repetición (`updateUser({ password })`); sin sesión de recuperación muestra "Enlace caducado" y un enlace a `/auth`. Manual: pedir el correo, abrir el enlace, cambiar la contraseña y entrar con la nueva.
10. **Nav y cierre de sesión.** Con sesión, el Nav muestra el nombre como etiqueta y un botón SALIR (barra y panel móvil); el botón "Iniciar Sesión" enlaza a `/auth?next=<ruta actual>`. Manual: iniciar y cerrar sesión desde `/`, `/games` y `/hall-of-fame` en escritorio y a 375 px.
11. **Puntuaciones con cuenta.** `GamePlayer.saveScore` incluye `user_id: user.id` cuando hay sesión; el campo de nombre del modal queda de solo lectura con el username de la cuenta; sin sesión se comporta como hasta ahora. Manual: guardar una puntuación con sesión y otra de invitado, y comprobar con `execute_sql` que la primera tiene `user_id` y la segunda `null`.
12. **Repaso.** `npm run lint`, `npx tsc --noEmit`, `npm run build`; recorrer todos los criterios con Playwright o el navegador; consola sin errores; `get_advisors`; borrar las cuentas y filas de prueba (`auth.users` y `scores`); retirar código muerto (el script temporal, `login` y los restos de `av_user`); actualizar `CLAUDE.md` (sección de sesión y de Supabase).

---

## Criterios de aceptación

**Calidad**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] La consola no muestra errores ni avisos de hidratación o de React en `/`, `/auth`, `/auth/reset` y `/games/snake/play`, con y sin sesión.
- [ ] Una búsqueda de `service_role` en `app/` no da resultados y no se añade ninguna variable de entorno ni dependencia nueva a `package.json`.
- [ ] `localStorage` no contiene `av_user` tras cargar la app (la clave heredada se elimina).
- [ ] `get_advisors` no muestra avisos de seguridad nuevos respecto a antes de la migración.

**Base de datos**

- [ ] `scores.user_id` existe, es `uuid` nullable y referencia `auth.users(id)` con `on delete set null`.
- [ ] El recuento de filas de `scores` y las vistas `game_best_scores` y `top_players` devuelven lo mismo que antes de la migración.
- [ ] Un insert como `anon` con `user_id = null` funciona; un insert como `anon` con un `user_id` cualquiera es rechazado por RLS.
- [ ] Un insert como `authenticated` con su propio `user_id` funciona; con el `user_id` de otra cuenta es rechazado.
- [ ] `list_migrations` incluye la migración nueva y `database.types.ts` tiene `user_id` en `scores`.

**Registro**

- [ ] Registrar usuario `TEST_01`, un correo válido y contraseña de 8 caracteres o más muestra "Revisa tu correo" y **no** inicia sesión.
- [ ] Un username de menos de 3 caracteres, de más de 10 o con caracteres fuera de `A-Z 0-9 _` (tras pasar a mayúsculas) muestra un error de campo y no llama a Supabase.
- [ ] Una contraseña de menos de 8 caracteres muestra error y no llama a Supabase.
- [ ] Registrar un correo ya existente muestra el mismo estado "Revisa tu correo" (sin revelar si la cuenta existe) y no crea una cuenta duplicada.
- [ ] El botón REENVIAR queda deshabilitado 60 s tras pulsarlo y envía un correo nuevo al volver a habilitarse.
- [ ] Abrir el enlace del correo lleva a `/auth/callback`, deja sesión iniciada, guarda `user_metadata.username = 'TEST_01'` y termina en `next` (o `/`).
- [ ] El botón de enviar queda deshabilitado mientras la petición está en curso: un doble clic envía una sola petición.

**Login**

- [ ] Con correo y contraseña correctos de una cuenta confirmada se inicia sesión y se va a `next` (o `/`); el Nav muestra `TEST_01`.
- [ ] Con contraseña incorrecta aparece "Correo o contraseña incorrectos" y no hay sesión.
- [ ] Con una cuenta sin confirmar aparece "Confirma tu correo antes de entrar" con la opción de reenviar.
- [ ] Abrir `/auth` con sesión iniciada redirige a `next` o a `/`.
- [ ] `next` se respeta solo si es una ruta interna: `/auth?next=/games/snake/play` vuelve al juego; `?next=//evil.com`, `?next=https://evil.com` y `?next=/\evil.com` terminan en `/`.
- [ ] JUGAR COMO INVITADO sigue ahí: cierra cualquier sesión y va a `/`.

**OAuth**

- [ ] Los botones GOOGLE y GITHUB inician el flujo OAuth y, al volver, hay sesión y el Nav muestra un username que cumple `USERNAME_RE`.
- [ ] Si el proveedor no está habilitado en el panel, el botón muestra "Este método de acceso no está disponible" y la página sigue utilizable.
- [ ] Cancelar el flujo en el proveedor vuelve a `/auth` con un aviso, sin error 500.

**Callback**

- [ ] `/auth/callback` sin `code` redirige a `/auth?error=callback` y la página muestra el aviso en español.
- [ ] `/auth/callback?code=invalido` redirige a `/auth?error=callback` sin error 500.

**Recuperación de contraseña**

- [ ] "¿Olvidaste tu contraseña?" abre un formulario de correo; enviarlo muestra un mensaje genérico ("Si el correo existe, recibirás un enlace") exista o no la cuenta.
- [ ] El enlace del correo lleva a `/auth/reset` con sesión de recuperación; cambiar la contraseña (8 o más caracteres, ambas iguales) permite entrar después con la nueva y no con la antigua.
- [ ] Contraseñas distintas o de menos de 8 caracteres muestran error y no llaman a Supabase.
- [ ] Abrir `/auth/reset` sin sesión de recuperación muestra "Enlace caducado" y un enlace a `/auth`.

**Sesión y Nav**

- [ ] Con sesión, el Nav muestra el username y SALIR en escritorio y en el panel móvil; sin sesión, "Iniciar Sesión" enlaza a `/auth?next=<ruta actual>`.
- [ ] SALIR cierra la sesión (`getSession()` devuelve nulo), el Nav vuelve a "Iniciar Sesión" y la sesión no reaparece al recargar.
- [ ] La sesión persiste al recargar la página y entre pestañas (iniciar sesión en una pestaña se refleja en la otra).
- [ ] Una recarga en `/` con sesión no produce error de hidratación (el HTML del servidor es sin sesión y pasa a la sesión real tras montar).
- [ ] `/hall-of-fame` resalta la fila del usuario con sesión por su username, como antes con el nombre local.

**Puntuaciones**

- [ ] Con sesión, el modal de fin de partida muestra el username de la cuenta en un campo de solo lectura; GUARDAR PUNTUACIÓN inserta una fila con `player_name = username` y `user_id = id` de la cuenta. Un doble clic crea una sola fila.
- [ ] Sin sesión, el modal sigue permitiendo escribir un nombre y guarda con `user_id = null`.
- [ ] Tras guardar con sesión, `/games/<id>` y `/hall-of-fame` muestran la puntuación como antes.
- [ ] Tras las pruebas, `scores` y `auth.users` no contienen filas de prueba.

**Diseño y maquetación**

- [ ] `/auth` y `/auth/reset` usan las clases `.auth-card`, `.field` y `.btn` existentes, con el estilo del resto de la app, y están diseñadas con `/frontend-design`.
- [ ] A 375 px no hay scroll horizontal en `/auth` ni en `/auth/reset`, y todos los botones miden al menos 44 px de alto.
- [ ] Cada campo tiene su `<label>`, los errores se anuncian (`role="alert"`) y los campos usan `autocomplete` correcto (`email`, `username`, `current-password`, `new-password`).

---

## Decisiones

- **Sí:** Supabase Auth con email y contraseña más Google y GitHub, por decisión del usuario. **No:** magic link, teléfono ni MFA: cada uno añade configuración y pantallas propias.
- **Sí:** el username en `user_metadata.username`, por decisión del usuario, sin tabla nueva. **No:** tabla `profiles` con username único. Consecuencia aceptada: dos cuentas pueden compartir nombre y el nombre del ranking no es prueba de identidad. `scores.user_id` es lo que identifica de verdad a quien guardó la puntuación.
- **Sí:** `scores.user_id` opcional con `on delete set null` y política `user_id is null or user_id = auth.uid()`. Impide atribuir una puntuación a otra cuenta sin cambiar el flujo de invitado. **No:** exigir sesión para guardar ni cerrar el insert público, por decisión del usuario.
- **Sí:** las vistas agrupan por `player_name` como hasta ahora; el ranking sigue siendo por nombre. **No:** reescribir `game_best_scores` y `top_players` por `user_id`: es un cambio de ranking que merece su propia spec. **Supuesto del agente.**
- **Sí:** confirmación de correo obligatoria, por decisión del usuario, con estado "Revisa tu correo" y reenvío. **No:** sesión inmediata tras registrarse. **Supuesto del agente:** el botón REENVIAR con enfriamiento de 60 s; sin él, un correo perdido sería un callejón sin salida.
- **Sí:** el login pide correo y contraseña. **No:** login por username, que exigiría una tabla propia (o una función SQL) para resolver username → correo.
- **Sí:** una única ruta `/auth/callback` con `exchangeCodeForSession` (PKCE) para confirmación, OAuth y recuperación; `next` viaja como parámetro. **No:** `/auth/confirm` con `token_hash` y `verifyOtp`: es un segundo camino para lo mismo. **Supuesto del agente.**
- **Sí:** `safeNext` valida `next` (solo rutas internas). **No:** confiar en el parámetro: sería una redirección abierta tras el login.
- **Sí:** `SessionProvider` mantiene la API `useSession()` y el patrón `useSyncExternalStore` con `getServerSnapshot` sin sesión. La sesión se lee en el cliente tras montar. **No:** leer el usuario en el servidor en el layout: con `cacheComponents` obligaría a envolver todo en `<Suspense>` o a volver dinámico el árbol. Coste aceptado: un parpadeo breve de "Iniciar Sesión" en la carga inicial, como ya ocurre hoy.
- **Sí:** el cliente nunca decide la autorización; la barrera real es la RLS con `auth.uid()`. La sesión del cliente solo sirve para pintar la interfaz.
- **Sí:** username en OAuth derivado del proveedor y persistido en el callback, por decisión del usuario. **No:** paso extra para elegirlo ni edición posterior en esta spec.
- **Sí:** con sesión, el nombre del modal es de solo lectura. Si fuera editable, la cuenta serviría de poco para evitar suplantaciones en el ranking. **Supuesto del agente.**
- **Sí:** el mensaje de "correo ya registrado" es el mismo que el de un registro nuevo, y el de recuperación es genérico, para no revelar qué correos existen.
- **Sí:** SMTP integrado de Supabase. **No:** SMTP propio con Resend ahora: es configuración aparte y se puede cambiar después sin tocar el código.
- **Sí:** mantener JUGAR COMO INVITADO, por decisión del usuario.
- **Sí:** se hace todo en una sola spec porque el usuario lo pidió así. Se puede partir por la mitad (email y sesión; OAuth y recuperación) si el tamaño resulta incómodo al implementar.

## Riesgos

| Riesgo                                                                       | Mitigación                                                                                                             |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| El SMTP integrado de Supabase tiene un límite bajo de correos por hora       | Mensaje `over_email_send_rate_limit`, enfriamiento de 60 s en REENVIAR; SMTP propio queda para otra spec               |
| Los Redirect URLs no incluyen la URL real y el callback falla en producción  | Paso 3 de configuración explícito; criterio de `/auth/callback` con código inválido; probar en local y en producción   |
| Los proveedores OAuth no están configurados cuando se implementa el paso 8   | Aviso `provider_disabled`; el paso 8 puede cerrarse al final sin bloquear el resto                                     |
| Hidratación: la sesión del cliente no coincide con el HTML del servidor      | `getServerSnapshot` sin sesión, como hoy; criterio de recarga sin error de hidratación                                 |
| Redirección abierta con `?next=`                                             | `safeNext` y criterios con `//evil.com`, `https://evil.com` y `/\evil.com`                                             |
| Dos cuentas con el mismo username (sin unicidad)                             | Aceptado por decisión del usuario; `user_id` identifica la cuenta; la unicidad queda para una spec de `profiles`       |
| Un usuario con cuenta de email y otro con OAuth del mismo correo se vinculan | Comportamiento por defecto de Supabase (solo vincula con correo verificado); se comprueba en la prueba manual de OAuth |
| Usar la clave `service_role` por comodidad                                   | Prohibido por `CLAUDE.md`; criterio de búsqueda de `service_role` en `app/`                                            |
| Cuentas y filas de prueba que se quedan en producción                        | Paso 12 las borra con `execute_sql`; criterio de `scores` y `auth.users` sin filas de prueba                           |
| El `proxy.ts` que refresca la sesión y el cliente del navegador discrepan    | No se toca `proxy.ts`; el cliente del navegador usa las mismas cookies de `@supabase/ssr`                              |
| Una política de insert más estricta rompe el guardado de invitados           | Criterio de insert como `anon` con `user_id` nulo; prueba de guardado de invitado en el paso 11                        |

---

## Qué **no** está en este spec

- Tabla `profiles`, usernames únicos y cambio de nombre.
- Magic link, SMS, MFA y más proveedores OAuth.
- Proteger rutas o exigir cuenta para guardar puntuación.
- Ligar a una cuenta las puntuaciones de invitado anteriores.
- Ranking por `user_id` en lugar de por `player_name`.
- Perfil, avatar, "Mi cuenta", cambio de correo o contraseña con sesión iniciada y borrado de cuenta.
- SMTP propio para los correos de Auth.
- Roles y panel de administración.
- Tests automatizados.

Cada uno de esos puntos, si se aborda, va en su propia spec.
