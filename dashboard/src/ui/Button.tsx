import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "alarm";
  isLoading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  isLoading,
  icon,
  className = "",
  disabled,
  type = "button",
  children,
  ...rest
}: ButtonProps): JSX.Element {
  const base =
    "btn rounded px-16 py-8 whitespace-nowrap text-16 font-mono tracking-wide leading-5";
  const variantClass =
    variant === "alarm"
      ? "btn-alarm"
      : variant === "ghost"
      ? "btn-ghost"
      : "btn-primary";

  return (
    <button
      type={type}
      className={`${base} ${variantClass} ${isLoading ? "cursor-wait" : ""} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {isLoading ? (
        <span className="h-3 w-3 rounded-full animate-pulse bg-current" />
      ) : icon ? (
        <span className="inline-flex">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

export const ActionButton = Button;
