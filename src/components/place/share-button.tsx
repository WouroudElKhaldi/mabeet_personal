"use client";

import { Check, Code2, Copy, Mail, MessageCircle, MoreHorizontal, Share, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";

/** "Share this place": copy the link, send it through an app, or embed it on another site. */
export function ShareButton({ title, summary, path }: { title: string; summary: string; path: string }) {
  const t = useTranslations("share");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);
  const [url, setUrl] = useState(path);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setUrl(new URL(path, window.location.origin).toString());
    setCanShare(typeof navigator.share === "function");
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  const text = `${title} · ${summary}`;
  const encoded = { url: encodeURIComponent(url), text: encodeURIComponent(`${text}\n${url}`) };
  const embed = `<iframe src="${url}" title="${title.replace(/"/g, "&quot;")}" width="100%" height="640" style="border:0;border-radius:16px" loading="lazy"></iframe>`;

  const copy = async (value: string, what: "link" | "embed") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard can be blocked; the link stays visible to copy by hand.
    }
  };

  const target = (href: string, icon: ReactNode, label: string) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-14 items-center gap-3 rounded-xl px-4 font-semibold ring-1 ring-line transition-colors hover:bg-surface-2"
    >
      {icon}
      {label}
    </a>
  );
  const brand = (letter: string, color: string) => (
    <span
      className="grid size-6 place-items-center rounded-md text-xs font-bold text-white"
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {letter}
    </span>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold underline-offset-4 hover:bg-surface-2 hover:underline"
      >
        <Share className="size-4" aria-hidden />
        {t("button")}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-end bg-ink/50 sm:place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="share-title"
              onClick={(event) => event.stopPropagation()}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
              className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-lift sm:max-w-xl sm:rounded-3xl"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("close")}
                className="-ms-2 -mt-2 grid size-9 place-items-center rounded-full hover:bg-surface-2"
              >
                <X className="size-5" aria-hidden />
              </button>
              <h2 id="share-title" className="mt-2 text-2xl font-semibold">
                {t("title")}
              </h2>
              <p className="mt-3 text-sm text-muted">
                <span className="font-semibold text-ink">{title}</span> · {summary}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void copy(url, "link")}
                  className="flex h-14 items-center gap-3 rounded-xl px-4 text-start font-semibold ring-1 ring-line transition-colors hover:bg-surface-2"
                >
                  {copied === "link" ? (
                    <Check className="size-5 text-success" aria-hidden />
                  ) : (
                    <Copy className="size-5" aria-hidden />
                  )}
                  {copied === "link" ? t("copied") : t("copyLink")}
                </button>
                {target(
                  `mailto:?subject=${encodeURIComponent(title)}&body=${encoded.text}`,
                  <Mail className="size-5" aria-hidden />,
                  t("email"),
                )}
                {target(
                  `sms:?&body=${encoded.text}`,
                  <MessageCircle className="size-5" aria-hidden />,
                  t("messages"),
                )}
                {target(`https://wa.me/?text=${encoded.text}`, brand("W", "#25d366"), "WhatsApp")}
                {target(`fb-messenger://share/?link=${encoded.url}`, brand("m", "#0084ff"), "Messenger")}
                {target(
                  `https://www.facebook.com/sharer/sharer.php?u=${encoded.url}`,
                  brand("f", "#1877f2"),
                  "Facebook",
                )}
                {target(
                  `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encoded.url}`,
                  brand("X", "#111111"),
                  "X (Twitter)",
                )}
                <button
                  type="button"
                  onClick={() => void copy(embed, "embed")}
                  className="flex h-14 items-center gap-3 rounded-xl px-4 text-start font-semibold ring-1 ring-line transition-colors hover:bg-surface-2"
                >
                  {copied === "embed" ? (
                    <Check className="size-5 text-success" aria-hidden />
                  ) : (
                    <Code2 className="size-5" aria-hidden />
                  )}
                  {copied === "embed" ? t("copied") : t("embed")}
                </button>
                {canShare && (
                  <button
                    type="button"
                    onClick={() => void navigator.share({ title, text: summary, url }).catch(() => undefined)}
                    className="flex h-14 items-center gap-3 rounded-xl px-4 text-start font-semibold ring-1 ring-line transition-colors hover:bg-surface-2"
                  >
                    <MoreHorizontal className="size-5" aria-hidden />
                    {t("more")}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
