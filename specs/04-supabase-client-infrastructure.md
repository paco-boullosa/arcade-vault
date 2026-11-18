# SPEC 04 — Infraestructura del cliente Supabase (browser + SSR)

> **Status:** Implementado
> **Depends on:** SPEC 03
> **Date:** 2026-11-18
> **Objective:** Instalar y configurar el cliente de Supabase para Next.js (navegador, servidor y `proxy.ts` de refresco de sesión) conectado al proyecto remoto, como base para los specs futuros de autenticación, base de datos y realtime.

---

## Por qué existe este spec

"Implementar Supabase" abarca auth, tablas, ranking en vivo y sustituir los datos ficticios de `app/data/`. Hacerlo en un solo spec mezclaría cuatro dominios. Este spec deja solo la base común: clientes, variables de entorno, `proxy.ts` y una comprobación de conexión. No cambia nada visible para el usuario: la sesión sigue siendo `av_user` en localStorage (`SessionProvider`) y los juegos y puntuaciones siguen siendo datos fijos.

---

## Alcance

**Dentro:**

- Dependencias `@supabase/supabase-js` y `@supabase/ssr`, y `tsx` como dependencia de desarrollo.
- Cliente de navegador en `app/lib/supabase/client.ts` (`createBrowserClient`).
- Cliente de servidor en `app/lib/supabase/server.ts` (`createServerClient` con las cookies de Next.js).
- Función `updateSession` en `app/lib/supabase/proxy.ts` que refresca la sesión y reescribe las cookies de la respuesta.
- `proxy.ts` en la raíz del proyecto (no hay directorio `src/`) que invoca `updateSession`.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, documentadas en `.env.example` y rellenadas en `.env.local`.
- Script `scripts/check-supabase.ts` y entrada `check:supabase` en `package.json` para comprobar la conexión.
- Conexión al proyecto Supabase remoto ya accesible por MCP.

**Fuera de alcance (para otros specs):**

- Autenticación real: registro, login, logout, métodos de acceso (email, social, magic link), confirmación de email y sustitución de `SessionProvider`.
- Tabla `profiles` y gestión del nombre de jugador.
- Tablas de la aplicación (`games`, `scores`) y migraciones.
- Políticas RLS.
- Realtime (canales, suscripciones).
- Tipos TypeScript generados de la base de datos (`database.types.ts`). Los clientes se crean sin genérico `Database`.
- Supabase local con CLI y Docker (`supabase/config.toml`).
- Sustituir los datos ficticios de `app/data/` por consultas.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

Este spec no introduce estructuras de datos ni tablas. Solo añade funciones de creación de clientes y variables de entorno.

```ts
// app/lib/supabase/client.ts
export function createClient(): SupabaseClient; // navegador

// app/lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient>; // servidor, lee cookies

// app/lib/supabase/proxy.ts
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse>;
```

Variables de entorno:

```bash
# .env.example (se añaden a las existentes)
NEXT_PUBLIC_SUPABASE_URL=                  # URL del proyecto, https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=      # publishable key (sb_publishable_...), segura para el navegador
```

Convenciones:

- Ambas variables llevan prefijo `NEXT_PUBLIC_` porque el cliente de navegador las necesita. La publishable key es pública por diseño y la protección real vendrá de RLS en el spec de BD.
- `SUPABASE_DB_PASS` ya existe en `.env.example`. Esta spec no la usa en código y el agente nunca la lee ni la escribe.
- Nunca se usa la `service_role` key en este spec ni se le da prefijo `NEXT_PUBLIC_` en ningún futuro.
- El cliente de servidor se crea por petición (no se guarda en una variable de módulo), por requisito de las cookies.
- `proxy.ts` excluye con su `matcher` los recursos estáticos (`_next/static`, `_next/image`, `favicon.ico` e imágenes).
- Si faltan las variables, `client.ts` y `server.ts` lanzan un error con el nombre de la variable que falta.

---

## Plan de implementación

Cada paso deja la app arrancando con `npm run dev` y es commiteable por separado.

1. **Leer la documentación.** Revisar en `node_modules/next/dist/docs/01-app` lo que afecta a este spec: archivo `proxy.ts` (nombre, ubicación y `matcher` en esta versión de Next.js, antes `middleware`), `cookies()` bajo `cacheComponents` y variables de entorno (`NEXT_PUBLIC_`). Revisar con `mcp__supabase__search_docs` la guía vigente de `@supabase/ssr` para Next.js. Ajustar los pasos siguientes si algo contradice este plan. No genera código.
2. **Dependencias.** Ejecutar `npm install @supabase/supabase-js @supabase/ssr` y `npm install -D tsx`. Comprobar que `npm run build` sigue funcionando.
3. **Entorno.** Obtener con el MCP de Supabase la URL (`get_project_url`) y la publishable key (`get_publishable_keys`) del proyecto. Añadir las dos variables a `.env.example` (vacías, con comentario) y rellenarlas en `.env.local`. No tocar `SUPABASE_DB_PASS` ni imprimir valores de `.env.local` en la salida.
4. **Cliente de navegador.** Crear `app/lib/supabase/client.ts` con `createBrowserClient` y la comprobación de variables. Verificar con `npx tsc --noEmit`.
5. **Cliente de servidor.** Crear `app/lib/supabase/server.ts` con `createServerClient`, `cookies()` de `next/headers` y `getAll`/`setAll`. El `setAll` captura el error cuando se llama desde un Server Component, según la guía oficial. Verificar con `npx tsc --noEmit`.
6. **Refresco de sesión.** Crear `app/lib/supabase/proxy.ts` con `updateSession` (cliente de servidor sobre `request`/`response`, llamada a `supabase.auth.getClaims()` y devolución de la respuesta con las cookies actualizadas). Crear `proxy.ts` en la raíz con `matcher` que excluye estáticos. Con `npm run dev`, `/`, `/games`, `/about` y `/auth` cargan igual que antes.
7. **Comprobación de conexión.** Crear `scripts/check-supabase.ts`, que usa `createClient` de `@supabase/supabase-js` con las dos variables (el cliente de servidor no funciona fuera de Next.js por depender de `cookies()`) y llama a `auth.getSession()`. Termina con código 0 e imprime `SUPABASE OK`, o con código 1 y el mensaje de error. Añadir a `package.json` el script `"check:supabase": "tsx --env-file=.env.local scripts/check-supabase.ts"`.
8. **Repaso final.** Ejecutar `npm run lint`, `npm run build` y `npm run check:supabase`. Comprobar en el navegador que no hay errores en consola y retirar código muerto.

---

## Criterios de aceptación

- [x] `npm run lint` termina sin errores.
- [x] `npm run build` termina sin errores.
- [x] `npx tsc --noEmit` termina sin errores.
- [x] `package.json` incluye `@supabase/supabase-js` y `@supabase/ssr` en `dependencies` y `tsx` en `devDependencies`.
- [x] Existen `app/lib/supabase/client.ts`, `app/lib/supabase/server.ts`, `app/lib/supabase/proxy.ts` y `proxy.ts` en la raíz.
- [x] `npm run check:supabase` imprime `SUPABASE OK` y termina con código 0.
- [x] Con `NEXT_PUBLIC_SUPABASE_URL` vacía, `npm run check:supabase` termina con código 1 y el mensaje nombra la variable que falta.
- [x] `/`, `/games`, `/games/<id>`, `/hall-of-fame`, `/about` y `/auth` responden 200 en `npm run dev` y se ven igual que antes.
- [x] El inicio de sesión simulado de `/auth` (`av_user` en localStorage) sigue funcionando y el nav muestra el nombre del usuario.
- [x] El envío del formulario de contacto de `/about` sigue funcionando.
- [x] La consola del navegador no muestra errores ni avisos de React en `/` ni en `/auth`.
- [x] `.env.example` está versionado con las dos variables nuevas vacías y `.env.local` sigue ignorado por git.
- [x] `git diff` y `.env.example` no contienen la publishable key, la `service_role` key ni `SUPABASE_DB_PASS`.
- [x] Una búsqueda de `service_role` en `app/`, `proxy.ts` y `scripts/` no da resultados.
- [x] `app/data/*.ts` y `app/components/SessionProvider.tsx` no tienen cambios respecto a la rama anterior.

---

## Decisiones

- **Sí:** spec solo de infraestructura. Auth, BD y realtime tienen decisiones propias (métodos de acceso, `profiles`, RLS) que se toman en sus specs, y mezclarlos supera el tamaño razonable de un spec.
- **No:** incluir auth o tablas aquí. El usuario pidió explícitamente dejarlos para specs posteriores.
- **Sí:** `@supabase/ssr` con cliente de navegador y de servidor separados. Es el patrón oficial para App Router y gestiona las cookies de sesión.
- **No:** `@supabase/auth-helpers-nextjs`. Está deprecado en favor de `@supabase/ssr`.
- **Sí:** `proxy.ts` con `updateSession` incluido ahora. Los specs de auth no tendrán que tocar la configuración SSR, y el coste hoy es una llamada por petición sin efecto visible.
- **No:** dejar el proxy para el spec de auth. Obligaría a ese spec a mezclar infraestructura con lógica de login.
- **Sí:** `auth.getClaims()` en el proxy en lugar de `getSession()`. `getSession()` no revalida el token en servidor y no es de fiar para decisiones de acceso. En este spec no se toman decisiones de acceso, pero deja el patrón correcto desde el inicio.
- **Sí:** proyecto Supabase remoto ya conectado por MCP. Evita exigir Docker y no añade archivos de configuración local.
- **No:** Supabase local con CLI. Es reproducible, pero aporta poco con un proyecto remoto ya disponible; queda para otro spec si se quiere.
- **Sí:** variable `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (formato nuevo `sb_publishable_...`). Es la nomenclatura vigente de Supabase y se puede rotar sin tocar la clave `service_role`.
- **No:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Es la nomenclatura heredada.
- **Sí:** el agente puede escribir la URL y la publishable key en `.env.local` obtenidas por MCP, porque son públicas por diseño y `.env.local` no se versiona. Nunca toca `SUPABASE_DB_PASS` ni la `service_role`.
- **Sí:** verificar con un script `scripts/check-supabase.ts` sin ruta pública. No deja endpoints que retirar ni proteger.
- **No:** Route Handler `/api/health/supabase`. Expone una ruta pública solo para una comprobación de desarrollo.
- **Sí:** el script usa `createClient` de `@supabase/supabase-js` en lugar de `server.ts`. El cliente de servidor depende de `cookies()` de `next/headers`, que solo existe dentro de una petición de Next.js. Es una desviación consciente respecto a probar los tres clientes. Los clientes de `app/lib/supabase/` se validan por compilación y por el arranque de `npm run dev` con el proxy activo.
- **Sí:** `tsx` con `--env-file=.env.local`. Evita añadir `dotenv` y reutiliza el mismo archivo de entorno que Next.js.
- **No:** generar `database.types.ts` ahora. Sin tablas de la app saldría casi vacío y quedaría desactualizado al primer spec de BD.
- **Sí:** clientes en `app/lib/supabase/`. Sigue la convención del proyecto (todo bajo `app/`, sin `src/`).
- **Sí:** el cliente de servidor se crea por petición. Las cookies son por petición y reutilizar una instancia mezclaría sesiones entre usuarios.

---

## Riesgos

| Riesgo                                                                                                               | Mitigación                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Next.js 16 cambia el nombre o el comportamiento del archivo de proxy respecto a lo que se conoce de `middleware.ts`. | El paso 1 lee la documentación local antes de escribir código y ajusta los nombres si hace falta.                                                      |
| `cacheComponents` hace que `cookies()` obligue a tratar el renderizado como dinámico en servidor.                    | El paso 1 revisa la documentación. Hoy ninguna página usa `server.ts`, así que no cambia el renderizado existente.                                     |
| El proxy se ejecuta en cada petición y añade latencia por la llamada a `getClaims()`.                                | El `matcher` excluye estáticos e imágenes. Sin sesión, `getClaims()` no hace petición de red. Se revisará en el spec de auth si afecta al rendimiento. |
| Una clave sensible acaba versionada o en el navegador.                                                               | Solo se usa la publishable key. Los criterios de aceptación revisan `git diff`, `.env.example` y buscan `service_role` en el código.                   |
| El script de comprobación pasa pero los clientes de `app/lib/supabase/` fallan en ejecución.                         | Se validan con `tsc`, `build` y el arranque de `npm run dev` con el proxy activo. Su uso real se prueba en el spec de auth.                            |
| El nombre de las claves de Supabase cambia entre proyectos antiguos (anon) y nuevos (publishable).                   | El paso 3 obtiene la clave con `get_publishable_keys`. Si el proyecto solo ofrece la clave anon, se detiene y se consulta antes de continuar.          |
| `SessionProvider` (sesión simulada) y Supabase conviven sin relación hasta el spec de auth.                          | El criterio de aceptación comprueba que `av_user` sigue funcionando y que `SessionProvider.tsx` no cambia.                                             |

---

## Qué **no** está en este spec

- Registro, login, logout ni ningún método de acceso real.
- Tabla `profiles`, nombre de jugador ni confirmación de email.
- Tablas, migraciones y políticas RLS.
- Realtime.
- Tipos generados de la base de datos.
- Supabase local con CLI y Docker.
- Sustituir los datos ficticios de `app/data/`.
- Tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propio spec.
