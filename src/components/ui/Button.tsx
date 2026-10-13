import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./Tooltip";

type Variant = "default" | "primary" | "danger" | "ghost";

export function Button({
  variant = "default",
  icon,
  small,
  tip,
  className,
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; icon?: boolean; small?: boolean; tip?: string }) {
  const v = { default: "", primary: "btn-primary", danger: "btn-danger", ghost: "btn-ghost" }[variant];
  const btn = (
    <button type="button" {...rest} className={cn("btn", v, icon && "btn-icon", small && "btn-sm", className)}>
      {children}
    </button>
  );
  return tip ? <Tooltip text={tip}>{btn}</Tooltip> : btn;
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input spellCheck={false} autoComplete="off" {...rest} className={cn("input", className)} />;
}

export function TextArea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea spellCheck={false} {...rest} className={cn("input", className)} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select"> & { children: ReactNode }) {
  return (
    <select {...rest} className={cn("input", className)}>
      {children}
    </select>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="tech-label">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-ink-faint">{hint}</span>}
    </label>
  );
}
