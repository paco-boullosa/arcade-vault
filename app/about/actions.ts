"use server";

import { Resend } from "resend";

export type ContactState =
  | { status: "idle" }
  | { status: "success"; name: string }
  | {
      status: "error";
      message: string; // texto en español mostrado en el formulario
      values: { name: string; email: string; msg: string }; // para no perder lo escrito
    };

const VALIDATION_ERROR = "RELLENA TODOS LOS CAMPOS CORRECTAMENTE.";
const SEND_ERROR = "NO SE PUDO ENVIAR EL MENSAJE. INTÉNTALO DE NUEVO.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function sendContactMessage(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const name = field(formData, "name");
  const email = field(formData, "email");
  const msg = field(formData, "msg");
  const website = field(formData, "website");

  // Honeypot: éxito falso, sin llamar a Resend ni dar pistas al bot.
  if (website !== "") {
    return { status: "success", name };
  }

  const values = { name, email, msg };

  const valid =
    name.length >= 1 &&
    name.length <= 60 &&
    email.length <= 120 &&
    EMAIL_RE.test(email) &&
    msg.length >= 10 &&
    msg.length <= 2000;

  if (!valid) {
    return { status: "error", message: VALIDATION_ERROR, values };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from =
    process.env.CONTACT_FROM_EMAIL || "Arcade Vault <onboarding@resend.dev>";

  if (!apiKey || !to) {
    console.error(
      "[contact] Falta configuración: RESEND_API_KEY o CONTACT_TO_EMAIL vacíos.",
    );
    return { status: "error", message: SEND_ERROR, values };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: email,
      subject: `[Arcade Vault] Mensaje de ${name.replace(/[\r\n]+/g, " ")}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${msg}`,
    });

    if (error) {
      console.error(
        `[contact] Resend devolvió un error: ${error.name}: ${error.message}`,
      );
      return { status: "error", message: SEND_ERROR, values };
    }
  } catch (err) {
    console.error("[contact] Fallo al enviar con Resend:", err);
    return { status: "error", message: SEND_ERROR, values };
  }

  return { status: "success", name };
}
