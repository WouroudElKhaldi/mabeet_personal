"use client";

import { Minus, Plus } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

export function GuestCounter({
  value,
  onChange,
  label,
  hint,
  max = 16,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  hint?: string;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <p className="font-semibold">{label}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      <div className="flex items-center gap-4">
        <CounterButton onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} label="−">
          <Minus className="size-4" aria-hidden />
        </CounterButton>
        <motion.span
          key={value}
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-6 text-center font-display text-xl font-semibold tabular-nums"
          aria-live="polite"
        >
          {value}
        </motion.span>
        <CounterButton onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} label="+">
          <Plus className="size-4" aria-hidden />
        </CounterButton>
      </div>
    </div>
  );
}

function CounterButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-9 place-items-center rounded-full ring-1 ring-line-strong transition-[transform,box-shadow] hover:ring-ink active:scale-90 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
