"use client";

import * as React from "react";
import { motion, AnimatePresence, MotionConfig, type Transition } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MorphButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text: string;
  isLoading?: boolean;
  icon?: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}

const MorphButton = React.forwardRef<HTMLButtonElement, MorphButtonProps>(
  ({ text, isLoading = false, icon, variant = "primary", className, onClick, ...props }, ref) => {
    const transition: Transition = {
      type: "spring",
      stiffness: 150,
      damping: 25,
      mass: 1,
    };

    const variantStyles = {
      primary:
        "border-white/20 bg-[linear-gradient(180deg,#8dff95_0%,#45d272_100%)] text-[#0a2314] shadow-[0_8px_24px_rgba(102,255,160,0.35)] hover:brightness-105",
      secondary: "border-white/20 bg-white/10 text-white hover:bg-white/20 shadow-sm",
      ghost: "border-transparent bg-transparent text-silver hover:bg-white/10 hover:text-white",
    };

    return (
      <MotionConfig transition={transition}>
        <motion.button
          ref={ref}
          layout
          className={cn(
            "relative flex h-12 items-center justify-center overflow-hidden rounded-full border font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            isLoading ? "px-0" : "px-8",
            variantStyles[variant],
            (props.disabled || isLoading) && "pointer-events-none cursor-not-allowed opacity-50",
            className,
          )}
          onClick={(e) => !isLoading && onClick?.(e)}
          whileTap={!isLoading ? { scale: 0.98 } : undefined}
          {...(props as any)}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {isLoading ? (
              <motion.div
                key="loader"
                className="flex items-center justify-center"
                style={{ width: "3rem" }}
                initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
              >
                <Loader2 className="h-5 w-5 animate-spin" />
              </motion.div>
            ) : (
              <motion.div
                key="content"
                className="flex items-center gap-2 whitespace-nowrap"
                initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(10px)" }}
              >
                {icon && <motion.span layout>{icon}</motion.span>}
                <motion.span layout>{text}</motion.span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </MotionConfig>
    );
  },
);

MorphButton.displayName = "MorphButton";

export { MorphButton };
