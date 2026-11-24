// Regla de contraseña para las contraseñas nuevas (registro y /auth/reset).
// El login no la valida: las cuentas antiguas con contraseñas más débiles
// siguen pudiendo entrar. La barrera real está en el panel de Supabase
// (Auth → Providers → Email); esto es una ayuda para la interfaz.

export const MIN_PASSWORD = 8;

// Símbolos admitidos: los de Supabase (`lower_upper_letters_digits_symbols`),
// no "cualquier carácter que no sea alfanumérico", para que cliente y servidor
// coincidan (`ñ`, espacios o emojis no cuentan como símbolo).
const LOWER = /[a-z]/;
const UPPER = /[A-Z]/;
const DIGIT = /\d/;
const SYMBOL = /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/;

// Al menos una minúscula, una mayúscula, un dígito y un símbolo; 8 o más caracteres.
export const PASSWORD_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]).{8,}$/;

export type PasswordChecks = {
  length: boolean; // >= 8 caracteres
  lower: boolean; // [a-z]
  upper: boolean; // [A-Z]
  digit: boolean; // \d
  symbol: boolean; // uno de !@#$%^&*()_+-=[]{};':"\|<>?,./`~
};

// Alimenta la lista de requisitos de la interfaz.
export function passwordChecks(value: string): PasswordChecks {
  return {
    length: value.length >= MIN_PASSWORD,
    lower: LOWER.test(value),
    upper: UPPER.test(value),
    digit: DIGIT.test(value),
    symbol: SYMBOL.test(value),
  };
}

// Fuente de verdad del envío.
export function isValidPassword(value: string): boolean {
  return PASSWORD_RE.test(value);
}

export const PASSWORD_RULE_MESSAGE = `La contraseña debe tener ${MIN_PASSWORD} o más caracteres, con minúsculas, mayúsculas, números y símbolos`;
