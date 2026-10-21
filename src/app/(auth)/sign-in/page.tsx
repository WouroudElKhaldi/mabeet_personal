import { AuthPage, authMetadata } from "@/components/account/auth-page";

export const generateMetadata = () => authMetadata("sign-in");

export default function SignInPage() {
  return <AuthPage mode="sign-in" />;
}
