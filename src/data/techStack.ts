/**
 * Tech Stack Metadata
 *
 * Purpose:
 * Central registry of technology labels and icon asset paths.
 *
 * Context:
 * Shared by homepage sections and project cards wherever technologies are displayed.
 *
 * Dependencies:
 * - icon assets under `/public/logos/tech`
 * - `TechIcon` for rendering
 *
 * Notes:
 * - IDs exported from this file are the canonical keys used across the app.
 * - Keep labels concise because they are reused for accessibility text.
 */
export const techStack = {
  react: { label: 'React', icon: '/logos/tech/react.svg' },
  nextjs: { label: 'Next.js', icon: '/logos/tech/nextjs.svg' },
  typescript: { label: 'TypeScript', icon: '/logos/tech/typescript.svg' },
  tailwind: { label: 'Tailwind CSS', icon: '/logos/tech/tailwind.svg' },
  nodejs: { label: 'Node.js', icon: '/logos/tech/nodejs.svg' },
  sanity: { label: 'Sanity', icon: '/logos/tech/sanity.svg' },
  github: { label: 'GitHub', icon: '/logos/tech/github.svg' },
  vercel: { label: 'Vercel', icon: '/logos/tech/vercel.svg' },
} as const;

export type TechId = keyof typeof techStack;

// Derived values
export const techStackEntries = Object.entries(techStack) as Array<
  [TechId, (typeof techStack)[TechId]]
>;
