import { CSSProperties, ReactNode } from "react";
import { HP } from "./tokens";

export function Pill({
  children,
  c = HP.chrome,
  fg = "#000",
  style,
}: {
  children: ReactNode;
  c?: string;
  fg?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 9999,
        background: c,
        padding: "3px 10px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.05em",
        color: fg,
        fontFamily: "system-ui",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
