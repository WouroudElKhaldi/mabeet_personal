import { clsx } from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const VARIANTS = {
  primary:
    "bg-accent text-accent-ink shadow-soft hover:bg-accent-strong hover:shadow-lift [&_svg]:transition-transform hover:[&_svg]:translate-x-0.5 rtl:hover:[&_svg]:-translate-x-0.5",
  secondary: "bg-surface text-ink ring-1 ring-line-strong hover:ring-ink/40 hover:bg-surface-2",
  ghost: "text-ink hover:bg-surface-2",
  danger: "bg-danger text-white hover:brightness-110",
} as const;

const SIZES = {
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-full",
  md: "h-11 px-5 text-[0.9375rem] gap-2 rounded-full",
  lg: "h-14 px-7 text-base gap-2.5 rounded-full",
  icon: "size-10 rounded-full justify-center",
} as const;

export interface ButtonStyle {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}

export function buttonClass({ variant = "primary", size = "md" }: ButtonStyle = {}, className?: string) {
  return clsx(
    "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap select-none",
    "transition-[background-color,box-shadow,transform,color] duration-300 ease-(--ease-out)",
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
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
