import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CapsuleTone = "mint" | "warning" | "danger" | "deep" | "bright";

const tones: Record<CapsuleTone, string> = {
  mint: "bg-chrome text-on-chrome",
  warning: "bg-warning text-on-warning",
  danger: "bg-danger text-white",
  deep: "bg-chrome-deep text-white",
  bright: "bg-chrome-bright text-on-chrome",
};

/** Status capsule. Sentence-case labels at the call site. */
export function Capsule({
  tone = "mint",
  children,
  className,
}: {
  tone?: CapsuleTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
