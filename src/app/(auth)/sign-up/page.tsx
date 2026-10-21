import { AuthPage, authMetadata } from "@/components/account/auth-page";

export const generateMetadata = () => authMetadata("sign-up");

export default function SignUpPage() {
  return <AuthPage mode="sign-up" />;
}
