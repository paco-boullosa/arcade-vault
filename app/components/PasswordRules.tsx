import { passwordChecks, type PasswordChecks } from "@/app/lib/auth/password";

const RULES: { key: keyof PasswordChecks; label: string }[] = [
  { key: "length", label: "8 o más caracteres" },
  { key: "lower", label: "Una minúscula (a-z)" },
  { key: "upper", label: "Una mayúscula (A-Z)" },
  { key: "digit", label: "Un número (0-9)" },
  { key: "symbol", label: "Un símbolo (! @ # $ % ...)" },
];

// Id de la región, para el `aria-describedby` del campo de contraseña.
export const passwordRulesId = (fieldId: string) => `${fieldId}-rules`;

// Requisitos de la contraseña nueva, marcados en vivo. `id` es el del campo.
export default function PasswordRules({
  value,
  id,
}: {
  value: string;
  id: string;
}) {
  const checks = passwordChecks(value);
  const done = RULES.filter((r) => checks[r.key]).length;
  return (
    <div
      id={passwordRulesId(id)}
      className={`pass-rules${done === RULES.length ? " is-complete" : ""}`}
      aria-live="polite"
    >
      <p className="pass-rules-title">Tu contraseña debe tener:</p>
      <ul>
        {RULES.map(({ key, label }) => (
          <li key={key} className={checks[key] ? "met" : undefined}>
            <span className="pass-rules-icon" aria-hidden="true">
              {checks[key] ? "✓" : "○"}
            </span>
            <span>
              {label}
              <span className="pass-rules-sr">
                {checks[key] ? ": cumplido" : ": pendiente"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
