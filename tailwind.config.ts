import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#fffdf8",
          100: "#fff9ee",
          200: "#fef2d9"
        },
        amber: {
          glow: "#ffb347"
        },
        teal: {
          glow: "#2dd4bf"
        },
        lavender: {
          glow: "#a78bfa"
        },
        ink: {
          900: "#2b2620",
          700: "#4a4238",
          500: "#7a7166"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.6), 0 8px 24px -4px rgba(255,179,71,0.25), 0 2px 8px -2px rgba(45,212,191,0.15)",
        "glow-lg": "0 0 0 1px rgba(255,255,255,0.7), 0 20px 50px -12px rgba(167,139,250,0.35), 0 8px 24px -8px rgba(255,179,71,0.25)",
        "glow-teal": "0 0 0 1px rgba(255,255,255,0.6), 0 8px 24px -4px rgba(45,212,191,0.35)"
      },
      backgroundImage: {
        "glow-radial": "radial-gradient(circle at 20% 20%, rgba(255,179,71,0.12), transparent 40%), radial-gradient(circle at 80% 0%, rgba(45,212,191,0.12), transparent 40%), radial-gradient(circle at 50% 100%, rgba(167,139,250,0.10), transparent 45%)"
      },
      borderRadius: {
        "2.5xl": "1.25rem",
        "3xl": "1.75rem"
      }
    }
  },
  plugins: []
};

export default config;
