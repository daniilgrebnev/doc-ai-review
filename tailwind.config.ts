import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent: "var(--accent)",
        muted: "var(--muted)",
        border: "var(--border)",
        sidebar: "var(--sidebar)",
        surface: "var(--surface)",
        primary: "var(--primary)",
        ring: "var(--ring)",
        paper: "var(--paper)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        line: "var(--line)",
        "line-2": "var(--line-2)",
        hover: "var(--hover)",
        well: "var(--well)",
        link: "var(--link)",
        bad: "var(--bad)",
        risk: "var(--risk)",
        ok: "var(--ok)",
      },
      fontFamily: {
        sans: ["Onest", "system-ui", "sans-serif"],
        serif: ["PT Serif", "Georgia", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        focus: "0 0 0 2px var(--surface), 0 0 0 4px var(--ring)",
      },
    },
  },
  plugins: [],
};
export default config;
