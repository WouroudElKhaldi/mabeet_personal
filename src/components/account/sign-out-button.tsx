"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const t = useTranslations("account");
  const router = useRouter();
  const signOut = async () => {
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  };
  return (
    <Button variant="ghost" size="sm" onClick={signOut}>
      <LogOut className="size-4" aria-hidden />
      {t("signOut")}
    </Button>
  );
}
