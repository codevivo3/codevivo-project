'use client';

import { useEffect, useState } from 'react';
import { motion, useTransform, type MotionValue } from 'framer-motion';


export type ProjectTag = {
  id: string;
  label: string;
};

export type ProjectItem = {
  id: string;
  title: string;
  description: string;
  tags: ProjectTag[];
};

type ProjectPanelProps = {
  item: ProjectItem;
  index: number;
  total: number;
  scrollYProgress: MotionValue<number>;
  overline: string;
  primaryLabel: string;
  secondaryLabel: string;
};

export default function ProjectPanel({
  item,
  index,
  total,
  scrollYProgress,
  overline,
  primaryLabel,
  secondaryLabel,
}: ProjectPanelProps) {
  const [hasAnimated, setHasAnimated] = useState(false);
  const segment = 1 / total;
  const start = index * segment;
  const end = start + segment;
  const enterPoint = start + segment * 0.2;
  const exitPoint = start + segment * 0.8;
  const isLast = index === total - 1;

  const opacity = useTransform(
    scrollYProgress,
    isLast
      ? [start, enterPoint, exitPoint]
      : [start, enterPoint, exitPoint, end],
    isLast ? [0, 1, 1] : [0, 1, 1, 0],
  );
  const pointerEvents = useTransform(opacity, (o) =>
    o > 0.5 ? 'auto' : 'none',
  );

  const scale = useTransform(
    scrollYProgress,
    isLast
      ? [start, enterPoint, exitPoint]
      : [start, enterPoint, exitPoint, end],
    isLast ? [0.96, 1.04, 1.04] : [0.96, 1.04, 1.04, 0.98],
  );

  const y = useTransform(
    scrollYProgress,
    isLast
      ? [start, enterPoint, exitPoint]
      : [start, enterPoint, exitPoint, end],
    isLast ? [40, 0, 0] : [40, 0, 0, -40],
  );

  useEffect(() => {
    const unsubscribe = opacity.on('change', (value) => {
      if (value > 0.9 && !hasAnimated) {
        setHasAnimated(true);
      }
    });

    return () => unsubscribe();
  }, [opacity, hasAnimated]);

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 16,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.35,
        ease: 'easeOut' as const,
      },
    },
  };

  const tagVariants = {
    hidden: {
      opacity: 0,
      y: 8,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.25,
      },
    },
  };

  return (
    <motion.div
      className='absolute inset-0 flex items-start justify-center pt-24 overflow-hidden'
      style={{
        zIndex: total - index,
        opacity,
        scale,
        y,
        pointerEvents,
      }}
    >
      <motion.article
        variants={containerVariants}
        initial='hidden'
        animate={hasAnimated ? 'visible' : 'hidden'}
        className='surface-card mx-auto w-full max-w-3xl rounded-xl bg-surface/60 p-10 text-center'
      >
        <motion.h3
          variants={itemVariants}
          className='mt-3 text-2xl font-semibold'
        >
          {item.title}
        </motion.h3>
        <motion.p variants={itemVariants} className='mt-4 text-sm text-fg/70'>
          {item.description}
        </motion.p>
        <div className='mt-6 flex flex-wrap justify-center gap-2'>
          {item.tags.map((tag) => (
            <motion.span
              key={tag.id}
              variants={tagVariants}
              className='rounded-full border border-border/50 px-2 py-0.5 text-xs text-fg/70 font-mono-var'
            >
              {tag.label}
            </motion.span>
          ))}
        </div>
        <motion.div
          variants={itemVariants}
          className='mt-6 flex flex-wrap justify-center gap-3'
        >
          <button className='w-full cursor-pointer rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-[var(--brand-honeydew)] transition hover:bg-surface hover:text-fg sm:w-auto'>
            {primaryLabel}
          </button>
          <button className='w-full cursor-pointer rounded-md border border-[var(--brand-gold)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-honeydew)] transition bg-[var(--brand-gold)] sm:w-auto hover:bg-surface hover:text-fg'>
            {secondaryLabel}
          </button>
        </motion.div>
      </motion.article>
    </motion.div>
  );
}
