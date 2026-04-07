import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
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
        chrome: "#00ffa3",
      },
      backgroundImage: {
        "frost-glass": "linear-gradient(135deg, rgba(18,26,41,0.9) 0%, rgba(15,21,34,0.88) 100%)",
        "frost-card": "linear-gradient(180deg, rgba(18,26,41,0.92) 0%, rgba(12,18,31,0.9) 100%)",
      },
      boxShadow: {
        glow: "0 0 24px rgba(0, 255, 163, 0.25)",
        "glow-hover": "0 0 36px rgba(0, 255, 163, 0.4)",
        inner: "inset 0 1px 0 rgba(255,255,255,0.06)",
      },
      borderRadius: {
        glass: "2px",
        "glass-lg": "2px",
      },
      backdropBlur: {
        glass: "12px",
        "glass-strong": "20px",
      },
    },
  },
  plugins: [],
};

export default config;
