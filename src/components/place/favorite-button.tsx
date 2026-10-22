"use client";

import { clsx } from "clsx";
import { Heart } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { toggleFavorite } from "@/app/actions/favorites";

/**
 * `overlay` sits on a photo: a white-outlined heart over a dark fill, readable on any image.
 * Without it, a labelled "Save" button for plain backgrounds such as the place page.
 */
export function FavoriteButton({
  slug,
  initial,
  signedIn,
  overlay = false,
}: {
  slug: string;
  initial: boolean;
  signedIn: boolean;
  overlay?: boolean;
}) {
  const t = useTranslations("place");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useOptimistic(initial);

  const toggle = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!signedIn) {
      router.push("/sign-in");
      return;
    }
    startTransition(async () => {
      setSaved(!saved);
      await toggleFavorite(slug, !saved);
    });
  };

  const heart = (
    <motion.span
      key={String(saved)}
      initial={{ scale: saved ? 0.6 : 1 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 600, damping: 18 }}
      className="grid"
    >
      <Heart
        aria-hidden
        strokeWidth={overlay ? 2.25 : 2}
        className={clsx(
          overlay ? "size-6 drop-shadow-sm" : "size-4",
          saved
            ? "fill-accent stroke-accent"
            : overlay
              ? "fill-black/40 stroke-white"
              : "fill-transparent stroke-ink",
        )}
      />
    </motion.span>
  );

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.85 }}
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? t("unsave") : t("save")}
      className={clsx(
        overlay
          ? "grid size-9 place-items-center transition-transform hover:scale-110"
          : "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold underline underline-offset-4 hover:bg-surface-2",
      )}
    >
      {heart}
      {!overlay && <span>{saved ? t("unsave") : t("save")}</span>}
    </motion.button>
  );
}
