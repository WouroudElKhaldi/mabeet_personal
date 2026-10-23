"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef } from "react";

/**
 * A popup for "show all" content: centred on a laptop, a full-screen sheet on a phone. On a phone the back
 * button closes it, as people expect, instead of leaving the page.
 */
export function SheetDialog({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const t = useTranslations("common");
  const dialog = useRef<HTMLDialogElement>(null);
  const pushed = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      history.pushState({ sheet: true }, "");
      pushed.current = true;
    }
    if (!open && element.open) {
      element.close();
      // Closed from the page (not by Back): drop the history entry added on open, so Back leaves the page.
      if (pushed.current) {
        pushed.current = false;
        history.back();
      }
    }
  }, [open]);

  useEffect(() => {
    const onBack = () => {
      if (!pushed.current) return;
      pushed.current = false;
      close.current();
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);

  const dismiss = () => onClose();

  return (
    <dialog
      ref={dialog}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onClick={(event) => event.target === dialog.current && dismiss()}
      className={`m-0 h-dvh max-h-none w-full max-w-none bg-surface p-0 text-ink backdrop:bg-black/60 sm:m-auto sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl sm:shadow-lift ${
        wide ? "sm:w-[min(64rem,calc(100vw-3rem))]" : "sm:w-[min(36rem,calc(100vw-3rem))]"
      }`}
    >
      {open && (
        <div className="flex h-full max-h-[inherit] flex-col">
          <header className="relative flex h-14 shrink-0 items-center justify-center border-b border-line px-14">
            <button
              type="button"
              onClick={dismiss}
              aria-label={t("close")}
              className="absolute start-3 grid size-9 place-items-center rounded-full hover:bg-surface-2"
            >
              <X className="size-4" aria-hidden />
            </button>
            <h2 className="truncate text-base font-semibold tracking-normal">{title}</h2>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        </div>
      )}
    </dialog>
  );
}
