import { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { HP } from "./tokens";

type Variant = "cta" | "ghost" | "danger";

const base: CSSProperties = {
  width: "100%",
  padding: "14px 18px",
  borderRadius: 12,
  border: "1px solid transparent",
  fontFamily: "system-ui",
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "0.02em",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  transition: "all 200ms",
};

const variants: Record<Variant, CSSProperties> = {
  cta: {
    ...base,
    borderColor: "rgba(0,255,163,0.6)",
    background: HP.cta,
    color: "#000",
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.1), ${HP.glow}`,
  },
  ghost: {
    ...base,
    borderColor: "rgba(255,255,255,0.18)",
    background: "transparent",
    color: HP.fg,
  },
  danger: {
    ...base,
    borderColor: "rgba(244,63,94,0.5)",
    background: "rgba(244,63,94,0.08)",
    color: "#fda4af",
  },
};

export function Btn({
  variant = "cta",
  children,
  style,
  disabled,
  ...rest
}: { variant?: Variant; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        ...variants[variant],
        ...(disabled ? { opacity: 0.55, cursor: "not-allowed" } : null),
        ...style,
      }}
    >
      {children}
    </button>
  );
}
