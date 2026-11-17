# SPEC 03 — Página "Acerca de" con contacto por Resend

> **Status:** Implementado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-11-17
> **Objective:** Crear la página `/about` basada en `references/templates/home-about/about.jsx`, con su enlace en el nav, y hacer que el formulario de contacto envíe un correo real al equipo mediante Resend desde una Server Action.

---

## Por qué existe este spec

La SPEC 02 dejó fuera `about.jsx` y el enlace "Acerca de" hasta que existiera la ruta. La plantilla simula el envío del formulario (solo cambia un estado local). Este spec porta la pantalla y sustituye esa simulación por un envío real. Es la primera funcionalidad del proyecto con código de servidor propio y con un secreto (`RESEND_API_KEY`), lo que rompe la convención de las SPEC 01 y 02 de "sin Server Actions ni API".

---

## Alcance

**Dentro:**

- Ruta `/about` con las secciones de `about.jsx`: hero "ACERCA DE ARCADE VAULT", tres destacados con icono, divisor de píxeles y bloque de contacto.
- Animación de aparición al hacer scroll (`.reveal`) mediante `IntersectionObserver`, igual que en la Home.
- Enlace "Acerca de" (`/about`) en la barra del nav y en el panel móvil, activo con `pathname.startsWith("/about")`.
- Formulario de contacto con nombre, correo y mensaje, y la terminal de éxito de la plantilla.
- Server Action `sendContactMessage` en `app/about/actions.ts` que valida en servidor y envía el correo con el SDK `resend`.
- Correo de texto plano al equipo con `Reply-To` igual al correo del usuario.
- Campo honeypot oculto contra bots.
- Mensaje de error visible en el formulario si la validación o Resend fallan, sin perder lo escrito.
- Variables de entorno `RESEND_API_KEY`, `CONTACT_TO_EMAIL` y `CONTACT_FROM_EMAIL`, y archivo `.env.example` versionado.
- Estilos de About y contacto copiados de `references/templates/home-about/styles.css` a `app/globals.css`.
- Metadatos de `/about`.

**Fuera de alcance (para otros specs):**

- Acuse de recibo o correo automático al usuario (exige dominio verificado en Resend).
- Dominio propio verificado en Resend. Se usa `onboarding@resend.dev` mientras tanto.
- Rate limit por IP (sin Redis/KV no es fiable en serverless).
- Guardar los mensajes en base de datos o en un panel de administración.
- Plantilla HTML del correo: el cuerpo es texto plano.
- Corregir las afirmaciones de la plantilla ("RESPUESTA EN 24-48H", "SIN SPAM, JAMÁS"). Se portan literalmente.
- Captcha (Turnstile, reCAPTCHA).
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

```ts
// app/about/actions.ts
export type ContactState =
  | { status: "idle" }
  | { status: "success"; name: string }
  | {
      status: "error";
      message: string;                 // texto en español mostrado en el formulario
      values: { name: string; email: string; msg: string }; // para no perder lo escrito
    };

export async function sendContactMessage(
  prev: ContactState,
  formData: FormData,
): Promise<ContactState>;
```

Campos de `FormData`: `name`, `email`, `msg` y `website` (honeypot).

Variables de entorno (solo servidor, nunca `NEXT_PUBLIC_`):

```bash
# .env.example
RESEND_API_KEY=            # API key de resend.com
CONTACT_TO_EMAIL=          # correo que recibe los mensajes (el de la cuenta de Resend en desarrollo)
CONTACT_FROM_EMAIL=Arcade Vault <onboarding@resend.dev>
```

Convenciones:

- Validación en servidor, tras `trim()`: `name` de 1 a 60 caracteres, `email` con formato válido y máximo 120, `msg` de 10 a 2000 caracteres.
- Si `website` no está vacío, la acción devuelve `{ status: "success", name }` sin llamar a Resend, para no dar pistas al bot.
- Asunto del correo: `[Arcade Vault] Mensaje de <name>`, con los saltos de línea del nombre sustituidos por espacios.
- Cuerpo en texto plano con nombre, correo y mensaje. Nunca se interpola en HTML.
- Si falta `RESEND_API_KEY` o `CONTACT_TO_EMAIL`, o Resend devuelve `error`, la acción registra el detalle con `console.error` en servidor y devuelve un mensaje genérico. El detalle nunca llega al cliente.
- Mensajes de error al usuario: `"RELLENA TODOS LOS CAMPOS CORRECTAMENTE."` para validación y `"NO SE PUDO ENVIAR EL MENSAJE. INTÉNTALO DE NUEVO."` para fallos de envío.

---

## Plan de implementación

Cada paso deja la app arrancando con `npm run dev` y es commiteable por separado.

1. **Leer la documentación de Next.js.** Revisar en `node_modules/next/dist/docs/01-app` lo que afecta a este spec: Server Actions (`'use server'`), `useActionState`, variables de entorno (`.env.local`) y comportamiento de `page.tsx` bajo `cacheComponents`. Ajustar los pasos siguientes si algo contradice este plan. No genera código.
2. **Dependencia y entorno.** Ejecutar `npm install resend`. Crear `.env.example` con las tres variables y añadir `!.env.example` a `.gitignore` (hoy `.env*` lo ignora). Crear `.env.local` con `CONTACT_FROM_EMAIL` y las otras dos vacías; el usuario aporta la API key después, el agente nunca la escribe ni la imprime.
3. **Estilos de About.** Copiar a `app/globals.css`, sin tocar las reglas existentes, el bloque `ABOUT PAGE` de `references/templates/home-about/styles.css` (`.about-*`, `.highlight*`, `.about-divider`, `.div-*`, `.about-contact`, `.contact-*`, `.terminal-success`, `.term-*`, `.tip*`) con sus `@media`. Omitir lo que ya exista (`.field`, `.reveal`, `@keyframes blink`) y comprobar si `@keyframes shake` y `.press` existen; copiarlos solo si faltan.
4. **Icono de destacados.** Crear `app/components/HighlightIcon.tsx` (servidor) con los iconos `HEART`, `BROWSER` y `PLANT` portados literalmente de `about.jsx`.
5. **Server Action.** Crear `app/about/actions.ts` con `ContactState` y `sendContactMessage` según el modelo de datos. Verificar con `npm run lint` y `npx tsc --noEmit`.
6. **Formulario.** Crear `app/components/ContactForm.tsx` (`'use client'`) con `useActionState(sendContactMessage, { status: "idle" })`: tres campos con `defaultValue` tomado de `values` en caso de error, honeypot `website` oculto (fuera de pantalla, `tabIndex={-1}`, `autoComplete="off"`, `aria-hidden`), botón "▶ ENVIAR MENSAJE" deshabilitado mientras `isPending`, bloque de error visible y terminal de éxito con el nombre en mayúsculas y botón "ENVIAR OTRO MENSAJE" que vuelve a `idle`. Mantener la animación `shake` cuando el estado pasa a `error`.
7. **Vista de About.** Crear `app/components/AboutView.tsx` (`'use client'`) con hero, destacados, divisor y bloque de contacto que monta `ContactForm`, más el `useEffect` con `IntersectionObserver` (umbral 0.12, `.in`, desconexión en el cleanup).
8. **Ruta `/about`.** Crear `app/about/page.tsx` (servidor) que renderiza `AboutView`, con `metadata.title` = `Arcade Vault · Acerca de`.
9. **Nav.** En `app/components/Nav.tsx` añadir "Acerca de" (`/about`) tras "Salón de la Fama", en la barra y en el panel móvil, con estado activo por `pathname.startsWith("/about")`.
10. **Prueba de envío real.** Con la API key ya en `.env.local`, enviar un mensaje desde `/about` en `npm run dev`, comprobar que llega a `CONTACT_TO_EMAIL` con `Reply-To` correcto y repasar visualmente `/about` frente a `about.jsx` en escritorio y a 375 px. Retirar código muerto.

---

## Criterios de aceptación

- [x] `npm run lint` termina sin errores.
- [x] `npm run build` termina sin errores.
- [x] `/about` muestra el título "ACERCA DE ARCADE VAULT", los 3 destacados con icono y el bloque "CONTÁCTANOS" con tres campos y el botón "ENVIAR MENSAJE".
- [x] Las secciones con `.reveal` de `/about` empiezan ocultas y aparecen al hacer scroll.
- [x] El nav muestra "Acerca de" en la barra y en el panel móvil, y lleva a `/about`.
- [x] "Acerca de" aparece resaltado en `/about` y "Inicio", "Biblioteca" y "Salón de la Fama" no.
- [x] Enviar el formulario vacío muestra `RELLENA TODOS LOS CAMPOS CORRECTAMENTE.`, aplica el shake y no llama a Resend.
- [x] Enviar un correo con formato inválido (`abc`) o un mensaje de menos de 10 caracteres muestra el mismo error y conserva lo escrito en los tres campos.
- [x] Enviar datos válidos con la API key configurada muestra la terminal de éxito con `GRACIAS, <NOMBRE EN MAYÚSCULAS>`.
- [x] El correo llega a `CONTACT_TO_EMAIL` con asunto `[Arcade Vault] Mensaje de <name>`, cuerpo con nombre, correo y mensaje, y `Reply-To` igual al correo introducido.
- [x] Con `RESEND_API_KEY` vacía, enviar datos válidos muestra `NO SE PUDO ENVIAR EL MENSAJE. INTÉNTALO DE NUEVO.`, conserva lo escrito y no muestra el detalle del error en la interfaz.
- [ ] Un envío con el campo `website` relleno muestra la terminal de éxito y no genera ningún correo.
- [x] El botón de enviar queda deshabilitado mientras el envío está en curso.
- [x] "ENVIAR OTRO MENSAJE" vuelve a mostrar el formulario vacío.
- [x] `RESEND_API_KEY` no aparece en el código enviado al navegador (búsqueda en `.next/static` sin resultados).
- [x] `.env.example` está versionado y `.env.local` está ignorado por git.
- [x] A 375 px de ancho `/about` no tiene scroll horizontal.
- [x] La consola del navegador no muestra errores ni avisos de React en `/about`.

---

## Decisiones

- **Sí:** Server Action con `useActionState`. Mantiene la API key solo en servidor y evita un endpoint público que mantener.
- **No:** Route Handler `app/api/contact/route.ts`. Añade fetch y parseo JSON sin beneficio mientras solo el formulario consume el envío.
- **Sí:** `onboarding@resend.dev` como remitente en desarrollo y `CONTACT_TO_EMAIL` como destinatario. Funciona sin dominio verificado. Pasar a dominio propio solo cambia variables de entorno.
- **No:** exigir dominio verificado ahora. Bloquea la implementación por una tarea ajena al código.
- **Sí:** `Reply-To` con el correo del usuario. Permite responder desde el cliente de correo sin copiar direcciones.
- **No:** acuse de recibo al usuario. Requiere dominio verificado, duplica plantillas y añade otro punto de fallo. Va en otro spec.
- **Sí:** validación en servidor, error visible y honeypot. El cliente no es de fiar y el honeypot corta el spam básico sin dependencias.
- **No:** librería de validación (zod). Son tres campos y no justifica una dependencia.
- **No:** rate limit en este spec. En memoria no es fiable en serverless y con KV/Redis merece su propio spec.
- **Sí:** cuerpo del correo en texto plano. Evita inyección de HTML con contenido del usuario.
- **No:** plantilla HTML o React Email. Es trabajo de diseño que no aporta al objetivo.
- **Sí:** mínimo de 10 caracteres en el mensaje. La plantilla solo exigía no vacío; el mínimo descarta mensajes basura. Es una desviación explícita de la plantilla.
- **Sí:** `.env.example` versionado con `!.env.example` en `.gitignore`. Documenta las variables sin exponer valores.
- **Sí:** en caso de honeypot se devuelve éxito falso. No da información al bot para adaptarse.
- **Sí:** el usuario aporta la API key después de la implementación del código, y el agente nunca la escribe en archivos versionados ni la muestra en la salida.
- **Sí:** `AboutView` es el único componente de cliente que gestiona el observador, y `ContactForm` el único con estado del formulario. `HighlightIcon` es de servidor.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `onboarding@resend.dev` solo puede enviar al correo de la cuenta de Resend. | `CONTACT_TO_EMAIL` en desarrollo es ese correo. Pasar a dominio propio queda como cambio de variables. |
| La API key se filtra al cliente o al repositorio. | Variable sin prefijo `NEXT_PUBLIC_`, uso solo en `app/about/actions.ts` y `.env.local` ignorado. El criterio de aceptación busca la clave en `.next/static`. |
| Spam o abuso del formulario sin rate limit. | Honeypot y validación en servidor. El rate limit queda explícitamente fuera y es candidato a su propio spec. |
| Resend falla o no está configurado y el usuario pierde su mensaje. | El estado de error devuelve `values` y el formulario los conserva con `defaultValue`. |
| Inyección de cabeceras mediante saltos de línea en el nombre. | El asunto sustituye los saltos de línea por espacios y el SDK recibe `replyTo` como valor, no como cabecera cruda. |
| `cacheComponents` cambia el renderizado de `page.tsx` y de las acciones. | El paso 1 revisa la documentación antes de escribir código. |
| `.gitignore` ignora `.env.example` por el patrón `.env*`. | El paso 2 añade la excepción `!.env.example`. |

---

## Qué **no** está en este spec

- Acuse de recibo o correo automático al usuario.
- Dominio propio verificado en Resend.
- Rate limit, captcha o cualquier otra defensa más allá del honeypot.
- Almacenamiento de mensajes o panel de administración.
- Plantilla HTML del correo.
- Corrección de las afirmaciones de marketing de la plantilla.
- Tests automatizados.

Cada uno de estos puntos, si se aborda, va en su propio spec.
