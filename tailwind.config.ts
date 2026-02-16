// File: ./tailwind.config.ts
// Tailwind CSS configuration file for the CodeVivo project.
// Defines custom theme extensions including fonts and color variables.
/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-montserrat)'],
        mono: ['var(--font-roboto-mono)'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        blue: 'var(--color-blue)',
        gold: 'var(--color-gold)',
        ash: 'var(--color-ash)',
        honeydew: 'var(--color-honeydew)',
        shadow: 'var(--color-shadow)',
      },
    },
  },
  plugins: [],
};

export default config;
