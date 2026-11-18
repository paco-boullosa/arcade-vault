import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Next.js solo inlinea NEXT_PUBLIC_* si se referencian de forma literal,
  // por eso no se leen con process.env[nombre].
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

  return createBrowserClient(url, key);
}
