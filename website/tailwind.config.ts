import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Share Tech Mono — Matrix terminal font, primary UI font.
        sans: [
          'Share Tech Mono',
          'Courier New',
          'Courier',
          'monospace',
        ],
        // DM Serif Display — kept for fallback.
        serif: [
          'Share Tech Mono',
          'Courier New',
          'Courier',
          'monospace',
        ],
        // Share Tech Mono — clinical labels, codes, PK values.
        mono: [
          'Share Tech Mono',
          'Courier New',
          'Courier',
          'monospace',
        ],
      },
      colors: {
        // Dark clinical design system — mirrors CSS custom properties in globals.css.
        vc: {
          // Backgrounds
          'navy-bg':          '#0a1628',
          'navy-card':        '#0f2040',
          'navy-card-raised': '#132848',
          'navy-border':      '#1e3a5f',
          'navy-border-strong': '#2a4f7a',
          // Teal accents
          teal:               '#0d9488',
          'teal-light':       '#14b8a6',
          // Text
          text:               '#f0f4f8',
          'text-secondary':   '#94a3b8',
          'text-muted':       '#4f6a8a',
          // Legacy aliases
          navy:               '#0C2340',
          blue:               '#0d9488',
          'blue-hover':       '#0f766e',
          'blue-accent':      '#14b8a6',
          background:         '#0a1628',
          surface:            '#0f2040',
          'surface-subtle':   '#132848',
          border:             '#1e3a5f',
          'border-strong':    '#2a4f7a',
        },
      },
    },
  },
  plugins: [],
};
export default config;
