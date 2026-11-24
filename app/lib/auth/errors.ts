// Textos de error en español, por `error.code` de Supabase Auth.
// `callback` es el código propio que usa /auth/callback en `/auth?error=...`.
const MESSAGES: Record<string, string> = {
  invalid_credentials: "Correo o contraseña incorrectos",
  email_not_confirmed: "Confirma tu correo antes de entrar",
  weak_password: "La contraseña es demasiado débil",
  over_email_send_rate_limit:
    "Demasiados correos enviados, espera unos minutos",
  provider_disabled: "Este método de acceso no está disponible",
  callback: "No se pudo completar el acceso. Inténtalo de nuevo",
};

export const DEFAULT_AUTH_ERROR =
  "No se pudo completar la operación. Inténtalo de nuevo";

export function authErrorMessage(code: string | null | undefined): string {
  // hasOwn: el código puede venir de la URL (`?error=`), no heredar del prototipo.
  return code && Object.hasOwn(MESSAGES, code)
    ? MESSAGES[code]
    : DEFAULT_AUTH_ERROR;
}
