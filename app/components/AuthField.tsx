import type { ComponentProps } from "react";

// Campo de formulario de las pantallas de acceso: label, input y error anunciado.
export default function AuthField({
  id,
  label,
  error,
  ...input
}: { id: string; label: string; error?: string } & ComponentProps<"input">) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
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
