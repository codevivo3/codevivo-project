// File: /Users/Francesco/Dev Projects/CodeVivo/codevivo-project/eslint.config.mjs

// Import necessary helpers from ESLint for configuration
import { defineConfig, globalIgnores } from "eslint/config";

// Import Next.js ESLint presets for Core Web Vitals and TypeScript support
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Define and export the ESLint configuration
const eslintConfig = defineConfig([
  ...nextVitals, // Include Core Web Vitals rules
  ...nextTs,     // Include TypeScript-specific rules

  // Override the default ignore patterns set by eslint-config-next
  globalIgnores([
    // These folders and files are ignored to avoid linting build artifacts and auto-generated files
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
