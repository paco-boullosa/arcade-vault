import type { Metadata } from "next";
import ResetPasswordForm from "../../components/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Arcade Vault · Nueva contraseña",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
