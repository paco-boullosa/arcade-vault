import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/app/lib/auth/redirect";
import type { Database } from "./database.types";

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) {
    throw new Error("Falta la variable de entorno NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!key) {
    throw new Error(
      "Falta la variable de entorno NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([name, value]) =>
          supabaseResponse.headers.set(name, value),
        );
      },
    },
  });

  // No ejecutar código entre createServerClient y getClaims(): un error aquí
  // puede cerrar sesiones de usuarios de forma aleatoria y es difícil de depurar.
  // getClaims() valida el token y refresca la sesión si ha caducado.
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;

  // Protección de rutas (SPEC 14). El modo invitado se mantiene: solo se
  // redirige en las rutas de abajo, nunca en las públicas.
  const { pathname, searchParams } = request.nextUrl;

  // /auth con sesión: ya no hace falta el formulario. Se vuelve a `next`, salvo
  // que apunte a /auth (bucle).
  if (pathname === "/auth" && signedIn) {
    const target = new URL(safeNext(searchParams.get("next")), request.url);
    return redirect(
      supabaseResponse,
      target.pathname === "/auth" ? new URL("/", request.url) : target,
    );
  }

  // /auth/reset exige la sesión de recuperación que deja /auth/callback.
  if (pathname === "/auth/reset" && !signedIn) {
    return redirect(supabaseResponse, new URL("/auth", request.url));
  }

  // Rutas privadas: sin sesión van al acceso y vuelven a la ruta tras entrar.
  if (!signedIn && isProtected(pathname)) {
    const login = new URL("/auth", request.url);
    login.searchParams.set("next", pathname + request.nextUrl.search);
    return redirect(supabaseResponse, login);
  }

  return supabaseResponse;
}

// Prefijos que exigen cuenta. Hoy no hay ninguna zona privada: se añade aquí
// (p. ej. "/perfil") cuando exista. Cubre la ruta y sus subrutas.
const PROTECTED_PREFIXES: readonly string[] = [];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

// Redirige conservando las cookies (y cabeceras de caché) que `getClaims()`
// haya refrescado: sin ellas una redirección podría perder la sesión.
function redirect(supabaseResponse: NextResponse, to: URL) {
  const response = NextResponse.redirect(to);
  supabaseResponse.cookies
    .getAll()
    .forEach((cookie) => response.cookies.set(cookie));
  supabaseResponse.headers.forEach((value, name) => {
    if (name.toLowerCase().startsWith("cache-control")) {
      response.headers.set(name, value);
    }
  });
  return response;
}
