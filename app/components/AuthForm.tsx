"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";
import { authErrorMessage } from "@/app/lib/auth/errors";
import { safeNext } from "@/app/lib/auth/redirect";
import { isValidUsername } from "@/app/lib/auth/username";
import { useSession } from "./SessionProvider";
import Field from "./AuthField";

const MIN_PASSWORD = 8;
const RESEND_COOLDOWN = 60;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

type Tab = "in" | "up";
type Provider = "google" | "github";
type FieldErrors = { username?: string; email?: string; password?: string };

export default function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const urlError = params.get("error");
  const { user, signOut } = useSession();

  const [tab, setTab] = useState<Tab>("in");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<{
    message: string;
    code?: string;
  } | null>(() => (urlError ? { message: authErrorMessage(urlError) } : null));
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [oauthProvider, setOauthProvider] = useState<Provider | null>(null);
  // Recuperación de contraseña: formulario de correo, y mensaje tras enviarlo.
  const [forgot, setForgot] = useState<"form" | "sent" | null>(null);
  const [cooldown, setCooldown] = useState(0);
  // El estado `busy` llega tras el render: la referencia corta un doble clic
  // que se cuele antes de que el botón quede deshabilitado.
  const busyRef = useRef(false);

  // Con sesión (también si se abre /auth ya con ella) se vuelve a `next`.
  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  // Al volver atrás desde el proveedor OAuth el navegador puede restaurar la
  // página con el estado ocupado: se libera.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      busyRef.current = false;
      setBusy(false);
      setOauthProvider(null);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const redirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  // Si la tarea devuelve `true` (login correcto) se mantiene el estado ocupado:
  // el botón no se reactiva mientras la página navega a `next`.
  const run = async (task: () => Promise<boolean | void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    let keepBusy = false;
    try {
      keepBusy = (await task()) === true;
    } finally {
      if (!keepBusy) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setFieldErrors({});
    setFormError(null);
    setNotice(null);
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (tab === "up" && !isValidUsername(username)) {
      errors.username = "Usa de 3 a 10 caracteres: letras, números o _";
    }
    if (!EMAIL_RE.test(email.trim())) {
      errors.email = "Escribe un correo válido";
    }
    if (pass.length < MIN_PASSWORD) {
      errors.password = `Mínimo ${MIN_PASSWORD} caracteres`;
    }
    return errors;
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busyRef.current) return;
    setFormError(null);
    setNotice(null);

    // En el login una contraseña corta no se valida: la decide Supabase.
    const errors = validate();
    if (tab === "in") delete errors.password;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const address = email.trim();
    void run(async () => {
      const supabase = createClient();
      if (tab === "up") {
        const { error } = await supabase.auth.signUp({
          email: address,
          password: pass,
          options: { data: { username }, emailRedirectTo: redirectTo() },
        });
        if (error) {
          setFormError({
            message: authErrorMessage(error.code),
            code: error.code,
          });
          return;
        }
        // Mismo estado exista o no la cuenta: no se revela qué correos hay.
        setSentTo(address);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: address,
        password: pass,
      });
      if (error) {
        setFormError({
          message: authErrorMessage(error.code),
          code: error.code,
        });
        return;
      }
      // Con sesión, el efecto de arriba navega a `next`.
      return true;
    });
  };

  const resend = () => {
    const address = sentTo ?? email.trim();
    if (cooldown > 0 || busyRef.current || !address) return;
    setFormError(null);
    setNotice(null);
    void run(async () => {
      const { error } = await createClient().auth.resend({
        type: "signup",
        email: address,
        options: { emailRedirectTo: redirectTo() },
      });
      setCooldown(RESEND_COOLDOWN);
      if (error) {
        setFormError({
          message: authErrorMessage(error.code),
          code: error.code,
        });
      } else {
        setNotice(`Correo reenviado a ${address}`);
      }
    });
  };

  const openForgot = () => {
    setFieldErrors({});
    setFormError(null);
    setNotice(null);
    setForgot("form");
  };

  const closeForgot = () => {
    setFieldErrors({});
    setFormError(null);
    setForgot(null);
  };

  const forgotSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busyRef.current) return;
    setFormError(null);

    const address = email.trim();
    if (!EMAIL_RE.test(address)) {
      setFieldErrors({ email: "Escribe un correo válido" });
      return;
    }
    setFieldErrors({});

    void run(async () => {
      const { error } = await createClient().auth.resetPasswordForEmail(
        address,
        {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset")}`,
        },
      );
      if (error) {
        setFormError({
          message: authErrorMessage(error.code),
          code: error.code,
        });
        return;
      }
      // Mismo mensaje exista o no la cuenta: no se revela qué correos hay.
      setForgot("sent");
    });
  };

  const guest = async () => {
    await signOut();
    router.push("/");
  };

  const oauth = (provider: Provider) => {
    if (busyRef.current) return;
    setFormError(null);
    setNotice(null);
    setOauthProvider(provider);
    void run(async () => {
      const fail = (code?: string) => {
        setOauthProvider(null);
        setFormError({ message: authErrorMessage(code), code });
      };

      // signInWithOAuth solo construye la URL: si el proveedor está
      // deshabilitado, Supabase responde un 400 JSON en su propio dominio y el
      // usuario saldría de la app. Se pide la URL sin redirigir y se sondea.
      const { data, error } = await createClient().auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectTo(), skipBrowserRedirect: true },
      });
      if (error || !data.url) return fail(error?.code);

      try {
        const probe = await fetch(data.url, { redirect: "manual" });
        // Con el proveedor activo la respuesta es una redirección opaca
        // (`opaqueredirect`); un 400 legible es un error de Supabase.
        if (probe.type === "cors" && probe.status >= 400) {
          const body = (await probe.json().catch(() => null)) as {
            error_code?: string;
          } | null;
          return fail(
            body?.error_code === "validation_failed"
              ? "provider_disabled"
              : body?.error_code,
          );
        }
      } catch {
        // Sin red para el sondeo: se intenta el flujo normal igualmente.
      }

      // El navegador va al proveedor: se mantiene el estado ocupado.
      window.location.assign(data.url);
      return true;
    });
  };

  const resendLabel =
    cooldown > 0 ? `REENVIAR EN ${cooldown} s` : "REENVIAR CORREO";

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        {formError && (
          <div className="auth-alert" role="alert">
            {formError.message}
            {formError.code === "email_not_confirmed" && (
              <button
                type="button"
                className="btn ghost"
                onClick={resend}
                disabled={busy || cooldown > 0}
              >
                {resendLabel}
              </button>
            )}
          </div>
        )}

        {sentTo ? (
          <div className="auth-sent">
            <h3 className="neon-cyan">Revisa tu correo</h3>
            <p>
              Hemos enviado un enlace de confirmación a{" "}
              <strong>{sentTo}</strong>. Ábrelo para activar tu cuenta y entrar.
            </p>
            <p className="hint">¿No llega? Mira en spam o reenvíalo.</p>
            {notice && (
              <div className="auth-notice" role="status">
                {notice}
              </div>
            )}
            <button
              type="button"
              className="btn"
              onClick={resend}
              disabled={busy || cooldown > 0}
            >
              {resendLabel}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setSentTo(null);
                setNotice(null);
                setFormError(null);
              }}
            >
              USAR OTRO CORREO
            </button>
          </div>
        ) : forgot === "sent" ? (
          <div className="auth-sent">
            <h3 className="neon-cyan">Revisa tu correo</h3>
            <p>
              Si el correo existe, recibirás un enlace para elegir una nueva
              contraseña.
            </p>
            <p className="hint">¿No llega? Mira en spam.</p>
            <button type="button" className="btn ghost" onClick={closeForgot}>
              VOLVER A INICIAR SESIÓN
            </button>
          </div>
        ) : forgot === "form" ? (
          <form onSubmit={forgotSubmit} noValidate>
            <p className="auth-lead">
              Escribe tu correo y te enviaremos un enlace para elegir una
              contraseña nueva.
            </p>
            <Field
              id="auth-email"
              type="email"
              label="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
              autoComplete="email"
              error={fieldErrors.email}
            />
            <button
              className="btn lg"
              type="submit"
              disabled={busy}
              style={{ width: "100%", marginTop: 8 }}
            >
              {busy ? "ENVIANDO…" : "ENVIAR ENLACE"}
            </button>
            <button type="button" className="auth-link" onClick={closeForgot}>
              Volver a iniciar sesión
            </button>
          </form>
        ) : (
          <>
            <div className="auth-tabs">
              <button
                type="button"
                className={tab === "in" ? "on" : ""}
                aria-pressed={tab === "in"}
                onClick={() => switchTab("in")}
              >
                INICIAR SESIÓN
              </button>
              <button
                type="button"
                className={tab === "up" ? "on" : ""}
                aria-pressed={tab === "up"}
                onClick={() => switchTab("up")}
              >
                CREAR CUENTA
              </button>
            </div>

            <form onSubmit={submit} noValidate>
              {tab === "up" && (
                <Field
                  id="auth-user"
                  label="Nombre de jugador"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toUpperCase())}
                  placeholder="PX_KAI"
                  autoComplete="username"
                  autoCapitalize="characters"
                  spellCheck={false}
                  error={fieldErrors.username}
                />
              )}
              <Field
                id="auth-email"
                type="email"
                label="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
                autoComplete="email"
                error={fieldErrors.email}
              />
              <Field
                id="auth-pass"
                type="password"
                label="Contraseña"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                autoComplete={
                  tab === "in" ? "current-password" : "new-password"
                }
                error={fieldErrors.password}
              />

              {tab === "in" && (
                <button
                  type="button"
                  className="auth-link"
                  onClick={openForgot}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}

              <button
                className="btn lg"
                type="submit"
                disabled={busy}
                style={{ width: "100%", marginTop: 8 }}
              >
                {busy
                  ? tab === "in"
                    ? "ENTRANDO…"
                    : "CREANDO…"
                  : tab === "in"
                    ? "ENTRAR AL VAULT"
                    : "CREAR CUENTA"}
              </button>
            </form>
          </>
        )}

        <button
          type="button"
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={guest}
        >
          JUGAR COMO INVITADO
        </button>

        {!sentTo && !forgot && (
          <>
            <div className="auth-divider">O CONTINÚA CON</div>
            <div className="social">
              <button
                className="btn ghost"
                type="button"
                disabled={busy}
                onClick={() => oauth("google")}
              >
                ◆&nbsp;&nbsp;GOOGLE
              </button>
              <button
                className="btn ghost"
                type="button"
                disabled={busy}
                onClick={() => oauth("github")}
              >
                ▣&nbsp;&nbsp;GITHUB
              </button>
            </div>
            {oauthProvider && (
              <div className="auth-notice" role="status">
                Conectando con{" "}
                {oauthProvider === "google" ? "Google" : "GitHub"}…
              </div>
            )}
          </>
        )}

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
