import { clsx } from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const VARIANTS = {
  primary: "bg-accent text-accent-ink hover:bg-accent-strong",
  secondary: "bg-surface text-ink ring-1 ring-ink hover:bg-surface-2",
  ghost: "text-ink underline-offset-4 hover:bg-surface-2",
  danger: "bg-danger text-danger-ink hover:brightness-110",
} as const;

const SIZES = {
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-5 text-[0.9375rem] gap-2 rounded-lg",
  lg: "h-12 px-6 text-base gap-2 rounded-lg",
  icon: "size-10 rounded-full justify-center",
} as const;

export interface ButtonStyle {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}

export function buttonClass({ variant = "primary", size = "md" }: ButtonStyle = {}, className?: string) {
  return clsx(
    "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap select-none",
    "transition-[background-color,box-shadow,transform,color] duration-150",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & ButtonStyle) {
  return <button type="button" className={buttonClass({ variant, size }, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonStyle & { children: ReactNode }) {
  return <Link className={buttonClass({ variant, size }, className)} {...props} />;
}
