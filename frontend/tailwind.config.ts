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
        glow: "rgba(250, 230, 210, 0.15)",
        "glow-strong": "rgba(250, 230, 210, 0.25)",
        silver: "#a1a1aa",
        chrome: "#e4e4e7",
      },
      backgroundImage: {
        "frost-glass": "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
        "frost-card": "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
      },
      boxShadow: {
        glow: "0 0 24px rgba(250, 230, 210, 0.12)",
        "glow-hover": "0 0 32px rgba(250, 230, 210, 0.2)",
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
