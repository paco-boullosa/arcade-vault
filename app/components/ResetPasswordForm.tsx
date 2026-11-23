"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/app/lib/supabase/client";
import { authErrorMessage } from "@/app/lib/auth/errors";
import Field from "./AuthField";

const MIN_PASSWORD = 8;

type Status = "checking" | "ready" | "expired" | "done";
type FieldErrors = { password?: string; repeat?: string };

export default function ResetPasswordForm() {
  const [status, setStatus] = useState<Status>("checking");
  const [pass, setPass] = useState("");
  const [repeat, setRepeat] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  // El enlace del correo pasa por /auth/callback, que deja la sesión de
  // recuperación en las cookies. Sin ella el enlace ha caducado o ya se usó.
  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled) setStatus(data.session ? "ready" : "expired");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busyRef.current) return;
    setFormError(null);

    const errors: FieldErrors = {};
    if (pass.length < MIN_PASSWORD) {
      errors.password = `Mínimo ${MIN_PASSWORD} caracteres`;
    }
    if (repeat !== pass) {
      errors.repeat = "Las contraseñas no coinciden";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    busyRef.current = true;
    setBusy(true);
    void createClient()
      .auth.updateUser({ password: pass })
      .then(({ error }) => {
        if (error) {
          setFormError(authErrorMessage(error.code));
        } else {
          setStatus("done");
        }
      })
      .finally(() => {
        busyRef.current = false;
        setBusy(false);
      });
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
        </div>

        {status === "checking" && (
          <p className="auth-lead" role="status">
            Comprobando el enlace…
          </p>
        )}

        {status === "expired" && (
          <div className="auth-sent">
            <h3 className="neon-magenta">Enlace caducado</h3>
            <p>
              Este enlace ya no es válido. Pide uno nuevo desde la pantalla de
              acceso.
            </p>
            <Link href="/auth" className="btn">
              VOLVER A ACCESO
            </Link>
          </div>
        )}

        {status === "done" && (
          <div className="auth-sent">
            <h3 className="neon-cyan">Contraseña cambiada</h3>
            <p>Ya puedes entrar con tu contraseña nueva.</p>
            <Link href="/" className="btn">
              IR AL VAULT
            </Link>
          </div>
        )}

        {status === "ready" && (
          <form onSubmit={submit} noValidate>
            <p className="auth-lead">Elige una contraseña nueva.</p>
            {formError && (
              <div className="auth-alert" role="alert">
                {formError}
              </div>
            )}
            <Field
              id="reset-pass"
              type="password"
              label="Contraseña nueva"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              error={fieldErrors.password}
            />
            <Field
              id="reset-repeat"
              type="password"
              label="Repite la contraseña"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              error={fieldErrors.repeat}
            />
            <button
              className="btn lg"
              type="submit"
              disabled={busy}
              style={{ width: "100%", marginTop: 8 }}
            >
              {busy ? "GUARDANDO…" : "GUARDAR CONTRASEÑA"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
