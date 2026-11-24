import { Suspense } from "react";
import type { Metadata } from "next";
import AuthForm from "../components/AuthForm";

export const metadata: Metadata = {
  title: "Arcade Vault · Acceso",
};

// AuthForm lee `?next=` y `?error=` con useSearchParams: requiere <Suspense>
// (cacheComponents).
export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
