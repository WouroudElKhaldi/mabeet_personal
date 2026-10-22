"use client";

import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { api } from "@/lib/api-client";

/** Reviews a stay (bookingId) or seats in an experience or service (sessionBookingId). */
export function ReviewForm(target: { bookingId: string } | { sessionBookingId: string }) {
  const t = useTranslations("account.review");
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const { run, pending, error } = useAction();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const comment = new FormData(event.currentTarget).get("comment");
    run(() => api.post("/api/me/reviews", { ...target, rating, comment }));
  };

  return (
    <form onSubmit={submit} className="grid gap-3 border-t border-line pt-4">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">
          {t("bookingId" in target ? "title" : "titleExperience")}
        </legend>
        {/* A 1 to 5 scale as numbered buttons, filled up to the chosen score. */}
        <div className="flex gap-1.5" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={t("stars", { count: value })}
              aria-pressed={rating === value}
              onMouseEnter={() => setHovered(value)}
              onClick={() => setRating(value)}
              className={clsx(
                "grid size-10 place-items-center rounded-lg text-sm font-bold tabular-nums ring-1 transition-colors",
                value <= (hovered || rating)
                  ? "bg-accent text-accent-ink ring-accent"
                  : "bg-surface text-muted ring-line-strong hover:text-ink",
              )}
            >
              {value}
            </button>
          ))}
          <span className="ms-2 self-center text-xs text-muted">{t("scale")}</span>
        </div>
      </fieldset>
      <textarea
        name="comment"
        required
        minLength={10}
        maxLength={2000}
        placeholder={t("placeholder")}
        aria-label={t("comment")}
        className={clsx(inputClass, "h-auto min-h-24 py-3")}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending || rating === 0}>
          {t("submit")}
        </Button>
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
