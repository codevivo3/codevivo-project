// File: ./tailwind.config.ts
// Tailwind CSS configuration file for the CodeVivo project.
// Defines custom theme extensions including fonts and color variables.
/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        // Typography tokens (wired to CSS variables in globals.css)
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [],
};

export default config;
