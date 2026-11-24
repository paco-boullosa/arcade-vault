# SPEC 14 — Medidas de seguridad básicas (RLS, Auth, contraseñas, headers y advisors)

> **Status:** Aprobado
> **Depends on:** SPEC 04, SPEC 06, SPEC 13
> **Date:** 2026-11-24
> **Objective:** Aplicar y verificar el checklist de `references/security/security-checklist.md` (RLS, límite de registros por IP, headers de Next.js y avisos del linter de Supabase) y exigir a las contraseñas nuevas por email un mínimo de 8 caracteres con minúscula, mayúscula, dígito y símbolo, validado con una expresión regular y explicado en la interfaz.

---

## Por qué existe este spec

El checklist mezcla cosas que ya están hechas, cosas que se cambian en código y cosas que solo existen en el panel de Supabase. Un estado real a fecha 2026-11-24, comprobado con `execute_sql` y `get_advisors`:

- **RLS:** ya está habilitado en `games` y `scores` (`relrowsecurity = true` en ambas). Aquí solo se vuelve a comprobar y se deja como criterio.
- **Contraseña mínima:** SPEC 13 la fijó en 8 en el cliente y en el panel, pero el panel no es verificable desde el repo; se reconfirma a mano.
- **Complejidad de contraseña:** hoy `AuthForm.tsx` (registro) y `ResetPasswordForm.tsx` solo comprueban `pass.length < 8`, cada uno con su propia constante `MIN_PASSWORD`; no hay regla de composición, ni texto que la explique, y `weak_password` en `app/lib/auth/errors.ts` dice solo "La contraseña es demasiado débil".
- **Linter:** hay 3 avisos `WARN`. Dos son `public.rls_auto_enable()` (función `SECURITY DEFINER` ejecutable por `anon` y `authenticated` vía `/rest/v1/rpc/rls_auto_enable`). Es la función del event trigger `ensure_rls`, que activa RLS en cada tabla nueva de `public`: es útil, pero no debe poder llamarse desde la API. Su ACL actual es `{=X/postgres, postgres, anon, authenticated, service_role}`, es decir, `PUBLIC` tiene `EXECUTE`. El tercero es `auth_leaked_password_protection`.
- **Headers:** `next.config.ts` no define ninguno.
- **Límite de registros:** no hay ninguno propio; se usa el de Supabase, que por defecto es 30 por IP cada 5 minutos.

El usuario ha decidido (y no quiere reabrir):

- `rls_auto_enable`: **revocar `EXECUTE`**, no moverla ni borrarla.
- Contraseñas filtradas: el proyecto está en plan **Free**, donde no se puede activar; se documenta como excepción aceptada.
- Límite de registros: **solo el límite de Supabase**, sin CAPTCHA.
- Headers: los 3 del checklist **más HSTS y Permissions-Policy**; sin CSP.
- Contraseñas nuevas por email: regla **"minúsculas, mayúsculas, dígitos y símbolos"** con **mínimo 8 caracteres**, validada con una expresión regular, y la interfaz debe explicarla al usuario.

---

## Alcance

**Dentro:**

- Migración `supabase/migrations/YYYYMMDDHHMMSS_revoke_rls_auto_enable_execute.sql` que retira `EXECUTE` de `public.rls_auto_enable()` a `PUBLIC`, `anon` y `authenticated`.
- Comprobación de que el event trigger `ensure_rls` sigue activando RLS en tablas nuevas tras la revocación.
- Comprobación de que RLS sigue habilitado en `games` y `scores` y de que sus políticas son las documentadas en `CLAUDE.md`.
- Headers de seguridad en `next.config.ts` mediante `headers()` para `/(.*)`: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security` y `Permissions-Policy`.
- Helper puro `app/lib/auth/password.ts` con la expresión regular, `MIN_PASSWORD` único y una función que devuelve el estado de cada requisito.
- Validar con ese helper la contraseña en el **registro por email** (`AuthForm.tsx`) y en **`/auth/reset`** (`ResetPasswordForm.tsx`), porque ambos fijan una contraseña nueva; el login no la valida.
- UI: lista de requisitos visible bajo el campo de contraseña del registro y de `/auth/reset`, que marca en vivo cuáles se cumplen; mensaje de error de campo y texto de `weak_password` que nombran la regla. Diseño con `/frontend-design`, reutilizando `.field` y `.auth-*`.
- Configuración manual en el panel de Supabase: longitud mínima 8, requisito "Lowercase, uppercase letters, digits and symbols" (la misma regla aplicada en el servidor) y límite de sign-ups/sign-ins por IP bajado a 5 cada 5 minutos.
- Documentar la excepción del aviso `auth_leaked_password_protection` (plan Free) en este spec y en `CLAUDE.md`.
- Marcar el checklist de `references/security/security-checklist.md` con el estado de cada punto.
- Actualizar `CLAUDE.md` (sección de seguridad y de Supabase).
- Protección de rutas con Proxy Next.js (más información en https://nextjs.org/docs/app/getting-started/proxy). Ejemplo proxy.ts:
```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This function can be marked `async` if using `await` inside
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url))
}

// Alternatively, you can use a default export:
// export default function proxy(request: NextRequest) { ... }

export const config = {
  matcher: '/about/:path*',
}
```

**Fuera de alcance (para otros specs):**

- `Content-Security-Policy`: con `cacheComponents` y los scripts inline de Next exige nonces (vía `proxy.ts`) y puede romper hidratación, Supabase u OAuth.
- CAPTCHA (Turnstile o hCaptcha) en el registro.
- Subir de plan para activar la protección contra contraseñas filtradas.
- Medidor de fortaleza (zxcvbn), botón de mostrar u ocultar contraseña y generador de contraseñas.
- Obligar a las cuentas existentes a cambiar su contraseña: la regla solo afecta a contraseñas nuevas; el login no valida la composición.
- Cerrar el insert público de `scores` a invitados o añadir anti-trampas (decisión de SPEC 13).
- Rate limiting propio en la app o en el borde (Vercel Firewall, middleware).
- Cambiar los privilegios por defecto de funciones futuras en `public` (`alter default privileges`).
- MFA, auditoría de logs de Auth y rotación de claves.
- Tests automatizados (no hay runner).

---

## Modelo de datos

Este spec no introduce tablas ni columnas. Solo cambia un privilegio y la configuración.

### Migración

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_revoke_rls_auto_enable_execute.sql
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
```

- Hay que revocar de `PUBLIC` además de `anon` y `authenticated`: el `EXECUTE` de `anon` y `authenticated` se hereda también de `PUBLIC`, y revocar solo de los roles no lo quita.
- No se toca `postgres` ni `service_role`.
- El event trigger `ensure_rls` es del propietario (`postgres`) y no depende de que `anon` o `authenticated` tengan `EXECUTE`; el paso 3 lo comprueba en vez de darlo por supuesto.
- `database.types.ts` no cambia: la función devuelve `event_trigger` y no aparece en el esquema de tipos expuesto.

### Headers (`next.config.ts`)

```ts
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

// dentro de nextConfig:
headers: async () => [{ source: "/(.*)", headers: securityHeaders }],
```

- `Strict-Transport-Security` sin `preload`: entrar en la lista de precarga es difícil de deshacer.
- `Permissions-Policy` no menciona `gamepad`: el mando de SPEC 11 usa la Gamepad API y desactivarla la rompería.
- `X-Frame-Options: DENY`: la app no se incrusta en iframes y los flujos OAuth de Google y GitHub son redirecciones de página completa, no iframes.
- El HSTS lo ignoran los navegadores sobre `http://localhost`; solo tiene efecto en producción con HTTPS.

### Contraseña (`app/lib/auth/password.ts`, funciones puras)

```ts
export const MIN_PASSWORD = 8;

// Al menos una minúscula, una mayúscula, un dígito y un símbolo; 8 o más caracteres.
// El conjunto de símbolos es el de Supabase (`lower_upper_letters_digits_symbols`),
// no "cualquier carácter que no sea alfanumérico", para que cliente y servidor coincidan.
export const PASSWORD_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]).{8,}$/;

export type PasswordChecks = {
  length: boolean; // >= 8 caracteres
  lower: boolean; // [a-z]
  upper: boolean; // [A-Z]
  digit: boolean; // \d
  symbol: boolean; // uno de !@#$%^&*()_+-=[]{};':"\|<>?,./`~
};

export function passwordChecks(value: string): PasswordChecks;
export function isValidPassword(value: string): boolean; // PASSWORD_RE.test(value)
```

- `PASSWORD_RE` es la fuente de verdad del envío; `passwordChecks` solo alimenta la lista de la interfaz y se construye con los mismos conjuntos de caracteres (un test manual del paso 6 comprueba que `isValidPassword` y "los cinco requisitos en verde" coinciden).
- `MIN_PASSWORD` sustituye a las constantes duplicadas de `AuthForm.tsx` y `ResetPasswordForm.tsx`.
- Letras con tilde (`ñ`, `á`) y espacios no cuentan como letra ni como símbolo: no están en los conjuntos de Supabase, y aceptarlos en el cliente haría que el servidor devolviera `weak_password`.
- La expresión regular es una comodidad de la interfaz, no una barrera: quien llame a la API de Auth directamente la salta. La barrera real es el requisito del panel (tabla siguiente).
- Textos (español): el error de campo es `La contraseña debe tener 8 o más caracteres, con minúsculas, mayúsculas, números y símbolos`; el texto de `weak_password` en `app/lib/auth/errors.ts` pasa a ser el mismo.

### Interfaz de requisitos

Bajo el campo **Contraseña** del registro (pestaña CREAR CUENTA) y bajo **Contraseña nueva** de `/auth/reset`, un bloque con la lista de cinco requisitos:

```
Tu contraseña debe tener:
  ○ 8 o más caracteres
  ○ Una minúscula (a-z)
  ○ Una mayúscula (A-Z)
  ○ Un número (0-9)
  ○ Un símbolo (! @ # $ % ...)
```

- Visible desde que se abre la pestaña de registro (antes de escribir), no solo al fallar.
- Cada requisito cambia a "cumplido" en vivo al escribir, con icono distinto (`○` → `✓`) y color, para no depender solo del color.
- La región usa `aria-live="polite"` y cada requisito indica su estado en texto accesible ("cumplido" o "pendiente"); el campo se asocia con `aria-describedby`.
- En la pestaña INICIAR SESIÓN la lista **no** aparece.
- Clases nuevas en `app/globals.css` con prefijo `.pass-rules`; se reutilizan `.field`, `.auth-card` y las clases `.auth-*`. Componente propio `app/components/PasswordRules.tsx` (props: `value`, `id`) usado por los dos formularios.
- A 375 px no desborda y no empuja el botón de enviar fuera de pantalla sin scroll vertical razonable.

### Configuración de Supabase Auth (manual, panel)

| Ajuste                                           | Valor                                                      |
| ------------------------------------------------ | ---------------------------------------------------------- |
| Auth → Providers → Email → Min password len.     | `8`                                                        |
| Auth → Providers → Email → Password requirements | `Lowercase, uppercase letters, digits and symbols`         |
| Auth → Rate Limits → sign-ups y sign-ins         | `5` por 5 minutos y por IP (es un único límite compartido) |
| Auth → Providers → Email → Leaked password       | No disponible en Free: excepción aceptada                  |

---

## Plan de implementación

1. **Leer la documentación.** La guía de `node_modules/next/dist/docs/01-app` sobre la opción `headers` de `next.config` (y su interacción con `cacheComponents` y `proxy.ts`), el aviso `0028`/`0029` del linter de Supabase y la sección de requisitos de contraseña de Supabase Auth (valores y conjunto de símbolos) con `mcp__supabase__search_docs`, y `app/components/{AuthForm,ResetPasswordForm}.tsx` y `app/lib/auth/errors.ts`. No genera código.
2. **Estado inicial.** Con `mcp__supabase__execute_sql`: `relrowsecurity` de `games` y `scores`, sus políticas (`pg_policies`) y el ACL de `rls_auto_enable`; con `mcp__supabase__get_advisors` (security): los 3 avisos actuales. Se apuntan los resultados en el mensaje final. Manual: RLS en `true` en ambas tablas y `scores_insert_own_or_guest` presente.
3. **Revocar `EXECUTE`.** Migración del modelo de datos aplicada con `mcp__supabase__apply_migration`. Manual: `proacl` ya no incluye `=X/postgres`, `anon` ni `authenticated`; una llamada `POST /rest/v1/rpc/rls_auto_enable` con la clave publicable devuelve error de permisos (no 200); y el event trigger sigue vivo: se crea `public.zz_rls_probe (id int)`, se comprueba `relrowsecurity = true` y se borra la tabla. Si el trigger dejara de funcionar, se revierte con un `grant` en una migración nueva y se replantea la decisión (mover a otro esquema).
4. **Headers.** Añadir `securityHeaders` y `headers()` a `next.config.ts` con los 5 valores del modelo de datos. Manual: `npx tsc --noEmit`, `npm run lint`, `npm run build` y `npm run start` sin errores.
5. **Verificar headers y que nada se rompe.** `curl -sI` a `/`, `/games`, `/auth` y `/games/snake/play` muestra los 5 headers; en el navegador (Playwright) `/games/snake/play` arranca el juego, el mando sigue detectándose y la consola no muestra errores nuevos. Manual: sin cambios de código.
6. **Helper de contraseña.** `app/lib/auth/password.ts` (`MIN_PASSWORD`, `PASSWORD_RE`, `passwordChecks`, `isValidPassword`) y nuevo texto de `weak_password` en `app/lib/auth/errors.ts`. Manual: `npx tsc --noEmit` y un script temporal con `tsx` (fuera de `app/`, se borra) que imprime casos: `Abcdef1!` → válida; `abcdef1!` (sin mayúscula), `ABCDEF1!` (sin minúscula), `Abcdefg!` (sin dígito), `Abcdefg1` (sin símbolo), `Ab1!` (corta), `Abcdef1ñ` (la `ñ` no es símbolo) y `Abcdef1 ` (el espacio no es símbolo) → inválidas; y para 200 cadenas aleatorias comprueba que `isValidPassword(s)` equivale a que los cinco `passwordChecks` sean `true`.
7. **Interfaz de requisitos.** Componente `app/components/PasswordRules.tsx` y clases `.pass-rules` en `app/globals.css`, diseñados con `/frontend-design`. Se usa en `AuthForm.tsx` (solo pestaña CREAR CUENTA) y en `ResetPasswordForm.tsx`; ambos sustituyen su `MIN_PASSWORD` y su comprobación de longitud por `isValidPassword` y el error de campo del modelo de datos; el login sigue sin validar la contraseña. Manual: `npx tsc --noEmit`, `npm run lint`; en `/auth` la lista aparece al abrir CREAR CUENTA, se va marcando al escribir, no aparece en INICIAR SESIÓN, y enviar con `abcdefgh` muestra el error de campo sin llamar a Supabase; igual en `/auth/reset`; a 375 px sin scroll horizontal.
8. **Configuración del panel.** El usuario aplica los tres ajustes de la tabla (longitud 8, requisito de caracteres y límite de registros) y lo marca como hecho. Comprobación funcional del requisito en el servidor, sin crear cuentas: `POST /auth/v1/signup` con la clave publicable, un correo de prueba y contraseña `abcdefgh` devuelve `422` con `weak_password`. Manual: el usuario lo confirma.
9. **Protección de rutas con Proxy Next.js**
10. **Documentación y repaso.** Marcar cada punto del checklist (`[x]`, o `[~]` con la excepción de contraseñas filtradas y su motivo); actualizar `CLAUDE.md` (headers en `next.config.ts`, la regla de contraseña y `app/lib/auth/password.ts`, la función revocada, la excepción del advisor y el límite de registros); `get_advisors` final; borrar cuentas y tablas de prueba; `npm run lint`, `npx tsc --noEmit` y `npm run build`.

---

## Criterios de aceptación

**Calidad**

- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` terminan sin errores.
- [ ] La consola no muestra errores ni avisos nuevos en `/`, `/auth` y `/games/snake/play`.
- [ ] No se añade ninguna dependencia ni variable de entorno, y una búsqueda de `service_role` en `app/` no da resultados.

**RLS**

- [ ] `games` y `scores` tienen `relrowsecurity = true`.
- [ ] Un `select` de `games` y `scores` como `anon` sigue funcionando y un insert como `anon` con `user_id = null` en `scores` sigue funcionando (el guardado de invitado no se rompe).
- [ ] Un `update` y un `delete` sobre `scores` como `anon` afectan a 0 filas.
- [ ] Tras la migración, crear una tabla nueva en `public` la deja con RLS habilitado (el event trigger `ensure_rls` sigue funcionando) y la tabla de prueba se borra.

**Función `rls_auto_enable`**

- [ ] `anon` y `authenticated` no tienen `EXECUTE` sobre `public.rls_auto_enable()` (`has_function_privilege` devuelve `false` para ambos).
- [ ] `POST /rest/v1/rpc/rls_auto_enable` con la clave publicable no devuelve 200.
- [ ] `list_migrations` incluye la migración nueva.
- [ ] `get_advisors` (security) ya no muestra `anon_security_definer_function_executable` ni `authenticated_security_definer_function_executable`.
- [ ] `get_advisors` (security) muestra como único aviso `auth_leaked_password_protection`, documentado como excepción aceptada en este spec y en `CLAUDE.md`.

**Headers**

- [ ] Las respuestas de `/`, `/games`, `/games/snake`, `/auth` y `/games/snake/play` incluyen `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=63072000; includeSubDomains` y `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- [ ] La respuesta de un recurso estático (`/_next/static/...`) también los incluye.
- [ ] `Permissions-Policy` no contiene `gamepad` y el mando sigue funcionando en un juego.
- [ ] Incrustar la app en un `<iframe>` de otro origen queda bloqueado por el navegador.
- [ ] El login con email y la vuelta de `/auth/callback` siguen funcionando con los headers activos.

**Contraseña (código)**

- [ ] `app/lib/auth/password.ts` exporta `MIN_PASSWORD = 8`, `PASSWORD_RE`, `passwordChecks` e `isValidPassword`, y `AuthForm.tsx` y `ResetPasswordForm.tsx` ya no definen su propio `MIN_PASSWORD`.
- [ ] `isValidPassword("Abcdef1!")` es `true`; `abcdef1!`, `ABCDEF1!`, `Abcdefg!`, `Abcdefg1`, `Ab1!`, `Abcdef1ñ` y `Abcdef1 ` (con espacio) dan `false`.
- [ ] Para cualquier cadena, `isValidPassword` coincide con que los cinco `passwordChecks` sean `true`.
- [ ] En el registro por email, una contraseña que incumple cualquier requisito muestra el error de campo y **no** llama a Supabase; una que los cumple procede como antes ("Revisa tu correo").
- [ ] En `/auth/reset`, la misma regla se aplica a la contraseña nueva y no llama a Supabase si falla; las contraseñas distintas siguen mostrando su error propio.
- [ ] En INICIAR SESIÓN no se valida la composición: una cuenta con una contraseña antigua que no cumple la regla sigue pudiendo entrar.
- [ ] `weak_password` muestra el nuevo texto que nombra la regla.

**Contraseña (interfaz)**

- [ ] Al abrir la pestaña CREAR CUENTA, bajo el campo de contraseña aparece la lista de 5 requisitos, todos pendientes, antes de escribir nada.
- [ ] Al escribir, cada requisito pasa a cumplido en cuanto se satisface y vuelve a pendiente si deja de cumplirse; con una contraseña válida los 5 están cumplidos.
- [ ] El estado de cada requisito se distingue sin depender del color (icono `○`/`✓` y texto accesible "cumplido"/"pendiente"), la región es `aria-live="polite"` y el campo tiene `aria-describedby` apuntando a ella.
- [ ] La lista no aparece en INICIAR SESIÓN ni en el formulario de recuperar contraseña por correo, y sí en `/auth/reset`.
- [ ] A 375 px no hay scroll horizontal en `/auth` ni en `/auth/reset`, y el botón de enviar sigue siendo alcanzable y de al menos 44 px.
- [ ] La lista usa las clases `.pass-rules` y `.field`/`.auth-*` del estilo de la app, está diseñada con `/frontend-design` y la consola no muestra errores de React ni de hidratación.

**Auth (panel)**

- [ ] `POST /auth/v1/signup` directo contra Supabase con contraseña `abcdefgh` devuelve `422` y `weak_password` (el servidor aplica la regla aunque se salte la interfaz); con `Abcdef1!` el servidor la acepta (cuenta de prueba que se borra después).
- [ ] Un registro completo desde la interfaz con una contraseña válida de 8 caracteres funciona.
- [ ] El límite de sign-ups y sign-ins por IP está en 5 cada 5 minutos en el panel (confirmado por el usuario).
- [ ] La protección contra contraseñas filtradas está anotada como no disponible en el plan Free, con la fecha de la comprobación.

**Documentación**

- [ ] `references/security/security-checklist.md` tiene los 5 puntos marcados con su estado real.
- [ ] `CLAUDE.md` recoge los headers, la función revocada, la excepción del advisor y el límite de registros.
- [ ] Tras las pruebas, no quedan tablas, cuentas ni filas de prueba (`public`, `auth.users`, `scores`).

---

## Decisiones

- **Sí:** revocar `EXECUTE` de `rls_auto_enable` a `PUBLIC`, `anon` y `authenticated`, por decisión del usuario. Conserva el RLS automático en tablas nuevas y cierra el acceso por la API. **No:** moverla a otro esquema (hay que recrear el event trigger) ni borrarla (se pierde la red de seguridad de RLS en migraciones futuras).
- **Sí:** revocar también de `PUBLIC`. **No:** revocar solo de `anon` y `authenticated`: seguirían heredando el privilegio de `PUBLIC` y el aviso no desaparecería.
- **Sí:** comprobar con una tabla de prueba que el trigger sigue funcionando, en lugar de suponerlo. **Supuesto del agente:** los event triggers no comprueban `EXECUTE` al dispararse; por eso se verifica.
- **Sí:** aceptar `auth_leaked_password_protection` como excepción documentada, por decisión del usuario (plan Free). **No:** subir de plan ni simular la comprobación con HaveIBeenPwned en el cliente. La mitigación es la longitud mínima de 8. Si el proyecto pasa a Pro, se activa en el panel sin cambios de código.
- **Sí:** solo el límite de registros de Supabase, por decisión del usuario. **No:** CAPTCHA ahora: añade dependencia, claves y código en `AuthForm`, y merece su propia spec.
- **Sí:** límite de 5 cada 5 minutos por IP, valor propuesto por el agente y aceptado. Consecuencia aceptada: en Supabase es **un único límite para sign-ups y sign-ins**, así que también limita los inicios de sesión desde una misma IP (una red compartida podría toparse con él). Se puede subir en el panel sin tocar el código.
- **Sí:** los 3 headers del checklist más HSTS y Permissions-Policy, por decisión del usuario. **No:** CSP: con `cacheComponents` y los scripts inline de Next exige nonces y puede romper hidratación, Supabase u OAuth.
- **Sí:** HSTS sin `preload`. **No:** entrar en la lista de precarga, difícil de deshacer.
- **Sí:** `Permissions-Policy` solo para cámara, micrófono y geolocalización. **No:** incluir `gamepad`: el mando táctil y el de SPEC 11 dependen de esa API. **Supuesto del agente.**
- **Sí:** headers en `next.config.ts` con `headers()`, como pide el checklist. **No:** ponerlos en `proxy.ts`: no hace falta ejecutar código por petición para valores estáticos.
- **Sí:** regla de contraseña "minúsculas, mayúsculas, dígitos y símbolos" con mínimo 8, por decisión del usuario, validada con una expresión regular en el cliente **y** aplicada en el servidor con el requisito del panel. **No:** solo cliente: se salta llamando a la API de Auth directamente.
- **Sí:** conjunto de símbolos igual al de Supabase en la regex. **No:** `[^A-Za-z0-9]`: aceptaría `ñ`, espacios o emojis en el cliente y el servidor los rechazaría con `weak_password`, con un error confuso. **Supuesto del agente:** el conjunto exacto se contrasta con la documentación en el paso 1.
- **Sí:** aplicar la regla también en `/auth/reset`, además del registro. **No:** dejarla solo en el registro: cualquiera podría poner una contraseña débil por la recuperación y la regla serviría de poco; además el servidor la aplica igualmente a `updateUser({ password })`. **Supuesto del agente** (el usuario pidió "nuevos usuarios por email"); si se prefiere solo el registro, se quita el uso en `ResetPasswordForm` y el servidor seguiría rechazándola con el texto de `weak_password`.
- **Sí:** el login no valida la composición. **No:** bloquear a cuentas existentes con contraseñas antiguas más débiles, que no habrían podido entrar.
- **Sí:** lista de requisitos visible desde el principio y marcada en vivo. **No:** mostrar la regla solo tras el fallo, ni un medidor de fortaleza (zxcvbn): el usuario pidió que sepa la regla, no estimar entropía.
- **Sí:** una sola fuente (`password.ts`) y un componente `PasswordRules` compartido por registro y reset. **No:** duplicar la regex y las constantes en cada formulario como ahora.
- **Sí:** el RLS ya existente se verifica y no se modifica. **No:** reescribir políticas: las de SPEC 06 y SPEC 13 no cambian.
- **Sí:** nueva migración para la revocación. **No:** editar una migración aplicada (regla del proyecto). La función `rls_auto_enable` no aparece en `supabase/migrations/`: la creó la plataforma, y esta migración deja constancia del cambio en el repo.

## Riesgos

| Riesgo                                                                             | Mitigación                                                                                                                           |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| La revocación rompe el event trigger y las tablas nuevas dejan de tener RLS        | Paso 3 y criterio con tabla de prueba; si falla, migración inversa con `grant` y replantear                                          |
| Los headers rompen OAuth, el mando o la hidratación                                | Paso 5 y criterios de login, mando y consola; `Permissions-Policy` sin `gamepad`; sin CSP                                            |
| `X-Frame-Options: DENY` bloquea una incrustación legítima futura                   | La app no se incrusta hoy; se relajaría a `SAMEORIGIN` o con CSP `frame-ancestors` en otra spec                                      |
| HSTS fija HTTPS durante 2 años en subdominios                                      | Sin `preload`; el dominio ya sirve HTTPS; se puede reducir `max-age` antes del primer despliegue si hay dudas                        |
| El límite de 5 por IP bloquea logins legítimos desde una red compartida            | Valor editable en el panel; mensaje `over_request_rate_limit` gestionado como error genérico de SPEC 13                              |
| El panel de Supabase no es verificable desde el repo y la config puede derivar     | Paso 6 con comprobación funcional (7 vs. 8 caracteres) y valores documentados en `CLAUDE.md`                                         |
| Sin protección de contraseñas filtradas, se aceptan contraseñas comprometidas      | Longitud mínima de 8 y excepción documentada; activarla al subir de plan                                                             |
| Los privilegios por defecto dan `EXECUTE` a `PUBLIC` en funciones futuras          | Fuera de alcance; el linter (`get_advisors`) del paso final de cada spec lo detectaría                                               |
| La regex del cliente y el requisito del servidor discrepan (símbolos, tildes)      | Conjunto de símbolos de Supabase en la regex, casos con `ñ` y espacio en el paso 6 y comprobación directa contra la API en el paso 8 |
| Las contraseñas con espacios o `ñ` se rechazan sin que el usuario entienda por qué | La lista dice "Un símbolo (! @ # $ % ...)" y la regla de la interfaz muestra los caracteres admitidos                                |
| El gestor de contraseñas genera una contraseña sin símbolos y el registro falla    | La lista aparece desde el principio; los campos mantienen `autocomplete="new-password"`                                              |
| Cuentas existentes con contraseña débil que no cumple la regla                     | Solo afecta a contraseñas nuevas; el login no valida; cambiarlas queda para otra spec                                                |
| Cuentas o tablas de prueba que se quedan en la base de datos                       | Paso 7 las borra; criterio de ausencia de filas de prueba                                                                            |

---

## Qué **no** está en este spec

- `Content-Security-Policy` ni nonces en `proxy.ts`.
- CAPTCHA en el registro.
- Subida de plan o protección contra contraseñas filtradas.
- Medidor de fortaleza, mostrar u ocultar contraseña y generador de contraseñas.
- Forzar el cambio de contraseña a cuentas existentes.
- Cerrar el insert público de `scores` ni anti-trampas.
- Rate limiting propio en la app o en el borde.
- Privilegios por defecto de funciones futuras.
- MFA, auditoría de logs y rotación de claves.
- Tests automatizados.

Cada uno de esos puntos, si se aborda, va en su propia spec.
