import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/ui/Button";

const variantMap = {
  cta: "filled",
  ghost: "gray",
  danger: "destructive",
} as const;

/** Shim: order screens should import Button (filled/gray/destructive). */
export function Btn({
  variant = "cta",
  children,
  ...rest
}: {
  variant?: keyof typeof variantMap;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button variant={variantMap[variant] as ButtonVariant} {...rest}>
      {children}
    </Button>
  );
}
