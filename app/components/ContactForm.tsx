"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { sendContactMessage, type ContactState } from "../about/actions";

const INITIAL_STATE: ContactState = { status: "idle" };

// El wrapper solo existe para poder "reiniciar" el formulario: cambiar la key
// remonta ContactFormInner y useActionState vuelve a `idle`.
export default function ContactForm() {
  const [resetKey, setResetKey] = useState(0);
  return (
    <ContactFormInner
      key={resetKey}
      onReset={() => setResetKey((k) => k + 1)}
    />
  );
}

function ContactFormInner({ onReset }: { onReset: () => void }) {
  const [state, formAction, isPending] = useActionState(
    sendContactMessage,
    INITIAL_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Reinicia la animación `shake` en cada error, incluso si hay errores seguidos.
  useEffect(() => {
    if (state.status !== "error") return;
    const el = formRef.current;
    if (!el) return;
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  }, [state]);

  const values = state.status === "error" ? state.values : undefined;

  return (
    <form
      ref={formRef}
      className="contact-form"
      action={formAction}
      noValidate
      onAnimationEnd={(e) => e.currentTarget.classList.remove("shake")}
    >
      {state.status !== "success" ? (
        <>
          <div className="field">
            <label htmlFor="contact-name">NOMBRE</label>
            <input
              id="contact-name"
              name="name"
              defaultValue={values?.name}
              placeholder="px_kai"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-email">CORREO ELECTRÓNICO</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              defaultValue={values?.email}
              placeholder="jugador@vault.gg"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-msg">MENSAJE</label>
            <textarea
              id="contact-msg"
              name="msg"
              rows={5}
              defaultValue={values?.msg}
              placeholder="Cuéntanos qué tienes en mente…"
            ></textarea>
          </div>

          {/* Honeypot: fuera de pantalla, los bots lo rellenan y las personas no. */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "-9999px",
              width: 1,
              height: 1,
              overflow: "hidden",
            }}
          >
            <label htmlFor="contact-website">WEBSITE</label>
            <input
              id="contact-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </div>

          {state.status === "error" && (
            <div
              role="alert"
              className="pixel"
              style={{
                marginBottom: 14,
                padding: "10px 12px",
                border: "1px solid var(--magenta)",
                color: "var(--magenta)",
                fontSize: 9,
                lineHeight: 1.6,
                letterSpacing: "0.1em",
                textShadow: "0 0 6px rgba(255,0,110,0.45)",
              }}
            >
              {state.message}
            </div>
          )}

          <button
            className="btn xl press"
            type="submit"
            disabled={isPending}
            style={{ width: "100%" }}
          >
            ▶&nbsp;&nbsp;ENVIAR MENSAJE
          </button>
        </>
      ) : (
        <div className="terminal-success">
          <div className="term-bar">
            <span className="dot r"></span>
            <span className="dot y"></span>
            <span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message
              --to=team
            </div>
            <div className="line dim">[OK] Conectando con servidor…</div>
            <div className="line dim">[OK] Validando contenido…</div>
            <div className="line dim">[OK] Transmitiendo paquete…</div>
            <div className="line success">
              &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS,{" "}
              {state.name.toUpperCase()}.<span className="caret">_</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <button className="btn ghost" type="button" onClick={onReset}>
                ENVIAR OTRO MENSAJE
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
