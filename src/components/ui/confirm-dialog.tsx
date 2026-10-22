"use client";

import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { inputClass } from "./field";

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel: string;
  /** Red confirm button for things that cannot be undone. */
  danger?: boolean;
  /** Ask for a reason: optional, or required with a minimum length. */
  reason?: { label: string; required?: boolean; minLength?: number; placeholder?: string };
}

export type ConfirmResult = { confirmed: false } | { confirmed: true; reason: string | null };

/**
 * One accessible confirmation step for anything destructive. Returns `ask(options)`, which resolves when the
 * person answers, and the dialog element to render once.
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<ConfirmResult>, ReactNode] {
  const t = useTranslations("confirm");
  const dialog = useRef<HTMLDialogElement>(null);
  const resolver = useRef<((result: ConfirmResult) => void) | null>(null);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [reason, setReason] = useState("");

  const settle = (result: ConfirmResult) => {
    resolver.current?.(result);
    resolver.current = null;
    dialog.current?.close();
  };

  const ask = useCallback((next: ConfirmOptions) => {
    setOptions(next);
    setReason("");
    requestAnimationFrame(() => dialog.current?.showModal());
    return new Promise<ConfirmResult>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const needed = options?.reason?.required ? (options.reason.minLength ?? 1) : 0;
  const tooShort = reason.trim().length < needed;

  const element = (
    <dialog
      ref={dialog}
      aria-labelledby="confirm-title"
      onCancel={() => settle({ confirmed: false })}
      onClick={(event) => event.target === dialog.current && settle({ confirmed: false })}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl bg-surface p-0 text-ink shadow-lift backdrop:bg-black/50"
    >
      {options && (
        <form
          method="dialog"
          onSubmit={(event) => {
            event.preventDefault();
            if (!tooShort) settle({ confirmed: true, reason: reason.trim() || null });
          }}
          className="grid gap-4 p-6"
        >
          <h2 id="confirm-title" className="text-lg font-semibold tracking-normal">
            {options.title}
          </h2>
          {options.body && <p className="text-[0.9375rem] leading-relaxed text-muted">{options.body}</p>}
          {options.reason && (
            <label className="grid gap-1.5 text-sm font-semibold">
              {options.reason.label}
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required={options.reason.required}
                minLength={options.reason.minLength}
                maxLength={300}
                placeholder={options.reason.placeholder}
                className={clsx(inputClass, "h-auto min-h-20 py-3 font-normal")}
              />
            </label>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => settle({ confirmed: false })}
              className="h-11 rounded-lg px-4 text-sm font-semibold hover:bg-surface-2"
            >
              {t("keep")}
            </button>
            <button
              type="submit"
              disabled={tooShort}
              autoFocus
              className={clsx(
                "h-11 rounded-lg px-5 text-sm font-semibold text-white transition-opacity disabled:opacity-40",
                options.danger ? "bg-danger hover:brightness-110" : "bg-ink text-paper hover:opacity-90",
              )}
            >
              {options.confirmLabel}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );

  return [ask, element];
}
