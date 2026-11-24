import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { deriveUsername } from "@/app/lib/auth/username";
import { safeNext } from "@/app/lib/auth/redirect";

// Punto de retorno único (PKCE) para la confirmación de correo, OAuth y la
// recuperación de contraseña. Cambia el `code` por una sesión y redirige a
// `next`. Cualquier fallo termina en /auth?error=callback, nunca en un 500.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const fail = () =>
    NextResponse.redirect(new URL("/auth?error=callback", request.url));

  // Sin código, o con el proveedor devolviendo un error (p. ej. el usuario
  // canceló en Google/GitHub: `error=access_denied`).
  if (!code || searchParams.has("error")) return fail();

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) return fail();

    // Cuentas de email: el username ya viaja en `options.data` del signUp.
    // Cuentas OAuth: se deriva del proveedor la primera vez.
    const meta = data.user.user_metadata ?? {};
    if (typeof meta.username !== "string" || meta.username === "") {
      // Si falla no bloquea el acceso: el Nav usa deriveUsername como respaldo.
      await supabase.auth.updateUser({
        data: { username: deriveUsername(meta, data.user.email) },
      });
    }
  } catch {
    return fail();
  }

  return NextResponse.redirect(new URL(next, request.url));
}
