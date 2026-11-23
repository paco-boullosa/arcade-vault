// Reglas del nombre de jugador. Funciones puras: sin React ni Supabase.

export const USERNAME_RE = /^[A-Z0-9_]{3,10}$/;

const MAX_LENGTH = 10;
const MIN_LENGTH = 3;

// Recorta, pasa a mayúsculas, quita lo que no sea [A-Z0-9_] y corta a 10.
export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "")
    .slice(0, MAX_LENGTH);
}

export function isValidUsername(value: string): boolean {
  return USERNAME_RE.test(value);
}

// Hash determinista a 3 dígitos: el mismo usuario obtiene siempre el mismo nombre.
function threeDigits(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return String(h % 1000).padStart(3, "0");
}

function firstString(meta: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}

// Nombre para cuentas OAuth: user_name, preferred_username, name o la parte
// local del correo, por ese orden. Si queda con menos de 3 caracteres, usa
// JUGADOR + 3 dígitos derivados del id del proveedor (`sub`/`provider_id`) o
// del correo.
export function deriveUsername(
  meta: Record<string, unknown>,
  email?: string | null,
): string {
  const candidate =
    firstString(meta, ["user_name", "preferred_username", "name"]) ??
    (email ? email.split("@")[0] : null);

  const normalized = candidate ? normalizeUsername(candidate) : "";
  if (normalized.length >= MIN_LENGTH) return normalized;

  const seed = firstString(meta, ["sub", "provider_id"]) ?? email ?? "";
  return `JUGADOR${threeDigits(seed)}`;
}
