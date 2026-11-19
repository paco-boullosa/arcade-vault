import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

// Se crea por petición: las cookies son por petición y reutilizar una
// instancia mezclaría sesiones entre usuarios. No guardar en variable de módulo.
export async function createClient() {
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

  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // setAll se llamó desde un Server Component, que no puede escribir
          // cookies. Se ignora porque proxy.ts refresca la sesión.
        }
      },
    },
  });
}
