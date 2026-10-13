import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
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
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: boolean; small?: boolean; tip?: string }) {
  const v = { default: "", primary: "btn-primary", danger: "btn-danger", ghost: "btn-ghost" }[variant];
  const btn = (
    <button type="button" {...rest} className={cn("btn", v, icon && "btn-icon", small && "btn-sm", className)}>
      {children}
    </button>
  );
  return tip ? <Tooltip text={tip}>{btn}</Tooltip> : btn;
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input spellCheck={false} autoComplete="off" {...rest} className={cn("input", className)} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea spellCheck={false} {...rest} className={cn("input", className)} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
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
