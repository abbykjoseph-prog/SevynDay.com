import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Enterprise navy/slate palette for SevynDay
        navy: {
          50: "#f2f5f9",
          100: "#e2e8f0",
          200: "#c4d0e0",
          300: "#9db0c9",
          400: "#6f89ac",
          500: "#4e6a90",
          600: "#3c5375",
          700: "#31435f",
          800: "#1e2d45",
          900: "#131f33",
          950: "#0a1120",
        },
        slate: {
          // Tailwind ships slate already; these mirror it for semantic clarity
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        accent: {
          // Muted, professional teal-blue used sparingly for CTAs & highlights
          50: "#eef7f9",
          100: "#d5ecf1",
          200: "#aad9e3",
          300: "#75bfcf",
          400: "#469db1",
          500: "#2f8194",
          600: "#29677a",
          700: "#265464",
          800: "#254654",
          900: "#233b47",
          950: "#11242d",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      maxWidth: {
        content: "72rem",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(2 6 23 / 0.04), 0 8px 24px -12px rgb(2 6 23 / 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
