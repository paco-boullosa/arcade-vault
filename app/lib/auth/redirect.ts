// Valida el parámetro `next` para evitar redirecciones abiertas tras el login.
// Solo se aceptan rutas internas: empiezan por `/` y no por `//` ni `/\`.
// Además se rechazan barras invertidas y caracteres de control en cualquier
// posición, porque los navegadores los normalizan (`/\t/evil.com` acabaría
// siendo `//evil.com`).
export function safeNext(next: unknown): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  if (next.includes("\\") || /[\u0000-\u001f\u007f]/.test(next)) return "/";
  return next;
}
