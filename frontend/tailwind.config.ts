import type { Config } from "tailwindcss";

const config: Config = {
  // lib/ and hooks/ contain client components too (sign-in modal, HashPack
  // confirm overlay) — classes used only there must be scanned, or they
  // silently fail to compile (e.g. the overlay's z-index and spinner colors).
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "rgba(255,255,255,0.04)",
          hover: "rgba(255,255,255,0.08)",
          active: "rgba(255,255,255,0.06)",
        },
        frost: "rgba(255,255,255,0.06)",
        glow: "rgba(0, 255, 163, 0.2)",
        "glow-strong": "rgba(0, 255, 163, 0.35)",
        silver: "#a9b0bf",
        chrome: {
          DEFAULT: "var(--color-chrome)",
          deep: "var(--color-chrome-deep)",
          bright: "var(--color-chrome-bright)",
        },
        bg: "var(--color-bg)",
        fg: "var(--color-fg)",
        muted: "var(--color-muted)",
        danger: "var(--color-danger)",
        warning: "var(--color-warning)",
        "on-chrome": "var(--color-on-chrome)",
        "on-warning": "var(--color-on-warning)",
        material: {
          regular: "var(--material-regular)",
          thick: "var(--material-thick)",
          chrome: "var(--material-chrome)",
        },
        scrim: "var(--scrim)",
        hairline: "var(--hairline)",
      },
      backgroundImage: {
        "frost-glass": "linear-gradient(135deg, rgba(18,26,41,0.9) 0%, rgba(15,21,34,0.88) 100%)",
        "frost-card": "linear-gradient(180deg, rgba(18,26,41,0.92) 0%, rgba(12,18,31,0.9) 100%)",
        cta: "var(--gradient-cta)",
      },
      boxShadow: {
        glow: "0 0 24px rgba(0, 255, 163, 0.25)",
        "glow-hover": "0 0 36px rgba(0, 255, 163, 0.4)",
        inner: "inset 0 1px 0 rgba(255,255,255,0.06)",
        tab: "0 8px 32px rgba(0, 0, 0, 0.35)",
      },
      borderRadius: {
        // Site-wide corner constitution. `glass` is the default radius for
        // buttons / inputs / small panels; `glass-lg` is for cards and
        // top-level surfaces. Keep changes here so the whole UI rounds
        // together.
        glass: "0.5rem", // 8px — matches tailwind's rounded-lg
        "glass-lg": "0.75rem", // 12px — matches tailwind's rounded-xl
        tab: "24px",
        sheet: "var(--radius-sheet)",
        control: "var(--radius-control)",
      },
      backdropBlur: {
        glass: "12px",
        "glass-strong": "20px",
        material: "20px",
        "material-thick": "28px",
      },
    },
  },
  plugins: [],
};

export default config;
