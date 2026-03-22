/**
 * ExploreProjects
 *
 * Purpose:
 * A navigational card that links to the full Projects page.
 * It visually aligns with ProjectCard but represents a portal rather than a project.
 *
 * Behavior:
 * - Large / medium screens: subtle hover scale interaction
 * - Mobile: fully visible, static-safe (no dependency on animation triggers)
 *
 * Notes:
 * - Must NOT mimic a real project card (no tech stack, no preview)
 * - Content is centered to differentiate from standard ProjectCard layout
 * - Acts as a transition from homepage to /projects
 */
'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';

// Styles

const cardClassName = 'mx-auto w-full max-w-5xl h-[276px] flex items-center justify-center';

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

// Component
export default function ExploreProjects() {
  const t = useTranslations('exploreProjects');

  // Render
  return (
    <motion.article
      className={cardClassName}
      aria-labelledby='explore-projects-card-title'
      variants={containerVariants}
      initial='hidden'
      whileInView='visible'
      viewport={{ once: true, amount: 0.6 }}
    >
      <div className='flex flex-col items-center justify-center text-center space-y-6'>
        <motion.div variants={itemVariants}>
          <h3
            id='explore-projects-card-title'
            className='text-xl font-semibold'
          >
            {t('title')}
          </h3>
        </motion.div>

        <motion.div variants={itemVariants}>
          <p className='text-sm leading-5 text-fg/72'>
            {t('description')}
          </p>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Button href='/projects' variant='primary'>
            {t('cta')}
          </Button>
        </motion.div>
      </div>
    </motion.article>
  );
}
