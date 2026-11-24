import type { ComponentProps } from "react";

// Campo de formulario de las pantallas de acceso: label, input y error anunciado.
// `describedBy` añade ids de ayuda (p. ej. la lista de requisitos de contraseña)
// al `aria-describedby`, junto al del error.
export default function AuthField({
  id,
  label,
  error,
  describedBy,
  ...input
}: {
  id: string;
  label: string;
  error?: string;
  describedBy?: string;
} & ComponentProps<"input">) {
  const described =
    [describedBy, error ? `${id}-error` : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        {...input}
      />
      {error && (
        <div id={`${id}-error`} className="field-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
