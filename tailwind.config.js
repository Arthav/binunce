/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,js}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
      colors: {
        base: "var(--bg-base)",
        panel: "var(--bg-panel)",
        elevated: "var(--bg-elevated)",
        line: "var(--border)",
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
        brand: "var(--brand)",
        long: "var(--long)",
        short: "var(--short)",
      },
      boxShadow: {
        win: "var(--shadow-win)",
        loss: "var(--shadow-loss)",
        panel: "inset 0 1px 0 rgba(255,255,255,0.03)",
      },
    },
  },
  plugins: [],
};
