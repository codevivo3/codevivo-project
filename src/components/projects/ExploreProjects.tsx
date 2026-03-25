/**
 * ExploreProjects
 *
 * Purpose:
 * Renders a dedicated navigation card that points users to the full projects archive.
 *
 * Context:
 * Used as the final item in homepage project flows.
 *
 * Dependencies:
 * - next-intl for localized copy
 * - shared `Button` styling
 * - Framer Motion for staged text/button reveal
 *
 * Notes:
 * - This should read as a transition card, not as another project entry.
 * - Keep the centered composition distinct from `ProjectCard`.
 */
'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';

// Styles

const cardClassName = 'mx-auto flex h-[240px] w-full max-w-5xl max-w-full items-center justify-center md:h-[276px]';

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

export default function ExploreProjects() {
  // Retrieve localized strings from next-intl messages (DO NOT hardcode text).
  const t = useTranslations('exploreProjects');
  return (
    <motion.article
      className={cardClassName}
      aria-labelledby='explore-projects-card-title'
      variants={containerVariants}
      initial='hidden'
      whileInView='visible'
      viewport={{ once: true, amount: 0.6 }}
    >
      <div className='flex w-full max-w-full flex-col items-center justify-center space-y-6 px-4 text-center'>
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
