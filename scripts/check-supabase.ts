import { createClient } from "@supabase/supabase-js";

// Se usa createClient de supabase-js y no app/lib/supabase/server.ts porque
// el cliente de servidor depende de cookies() de next/headers, que solo
// existe dentro de una petición de Next.js.
async function main() {
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

  const supabase = createClient(url, key);
  const { error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  console.log("SUPABASE OK");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
