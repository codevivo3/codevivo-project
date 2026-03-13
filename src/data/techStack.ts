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

export const techStackEntries = Object.entries(techStack) as Array<
  [TechId, (typeof techStack)[TechId]]
>;
