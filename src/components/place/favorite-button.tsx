"use client";

import { clsx } from "clsx";
import { Heart } from "lucide-react";
import { motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { toggleFavorite } from "@/app/actions/favorites";

export function FavoriteButton({
  slug,
  initial,
  signedIn,
}: {
  slug: string;
  initial: boolean;
  signedIn: boolean;
}) {
  const t = useTranslations("place");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useOptimistic(initial);

  const toggle = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!signedIn) {
      router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
      return;
    }
    startTransition(async () => {
      setSaved(!saved);
      await toggleFavorite(slug, !saved);
    });
  };

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.8 }}
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? t("unsave") : t("save")}
      className="grid size-10 place-items-center rounded-full bg-paper/75 backdrop-blur-md transition-colors hover:bg-paper"
    >
      <motion.span
        key={String(saved)}
        initial={{ scale: saved ? 0.4 : 1 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 600, damping: 14 }}
      >
        <Heart
          className={clsx("size-[1.15rem]", saved ? "fill-danger stroke-danger" : "stroke-ink")}
          aria-hidden
        />
      </motion.span>
    </motion.button>
  );
}
