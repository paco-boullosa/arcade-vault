import type { Metadata } from "next";
import AuthForm from "../components/AuthForm";

export const metadata: Metadata = {
  title: "Arcade Vault · Acceso",
};

export default function AuthPage() {
  return <AuthForm />;
}
