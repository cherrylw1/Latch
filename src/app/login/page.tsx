import { LoginForm } from "@/components/login-form";
import { isAuthConfigured } from "@/lib/server/auth";

export default function LoginPage() {
  return <LoginForm configured={isAuthConfigured()} />;
}
