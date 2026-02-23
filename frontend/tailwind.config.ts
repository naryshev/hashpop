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
        glow: "rgba(20, 164, 255, 0.2)",
        "glow-strong": "rgba(20, 164, 255, 0.35)",
        silver: "#a9b0bf",
        chrome: "#edf2ff",
      },
      backgroundImage: {
        "frost-glass": "linear-gradient(135deg, rgba(18,26,41,0.9) 0%, rgba(15,21,34,0.88) 100%)",
        "frost-card": "linear-gradient(180deg, rgba(18,26,41,0.92) 0%, rgba(12,18,31,0.9) 100%)",
      },
      boxShadow: {
        glow: "0 0 24px rgba(20, 164, 255, 0.22)",
        "glow-hover": "0 0 32px rgba(20, 164, 255, 0.34)",
        inner: "inset 0 1px 0 rgba(255,255,255,0.06)",
      },
      borderRadius: {
        glass: "12px",
        "glass-lg": "16px",
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
