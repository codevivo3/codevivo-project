'use client';

import { useEffect, useState } from 'react';
import { motion, useTransform, type MotionValue } from 'framer-motion';
import ProjectCard from '@/components/ProjectCard';
import { type TechId } from '@/data/techStack';


export type ProjectItem = {
  id: string;
  title: string;
  description: string;
  tags: TechId[];
  projectUrl: string;
  githubUrl: string;
};

type ProjectPanelProps = {
  item: ProjectItem;
  index: number;
  total: number;
  scrollYProgress: MotionValue<number>;
  primaryLabel: string;
  secondaryLabel: string;
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

function getPanelScrollRange(index: number, total: number, isLast: boolean) {
  const segment = 1 / total;
  const start = index * segment;
  const end = start + segment;
  const enterPoint = start + segment * 0.2;
  const exitPoint = start + segment * 0.8;

  return {
    inputRange: isLast
      ? [start, enterPoint, exitPoint]
      : [start, enterPoint, exitPoint, end],
    opacityRange: isLast ? [0, 1, 1] : [0, 1, 1, 0],
    scaleRange: isLast ? [0.96, 1.04, 1.04] : [0.96, 1.04, 1.04, 0.98],
    yRange: isLast ? [40, 0, 0] : [40, 0, 0, -40],
  };
}

export default function ProjectPanel({
  item,
  index,
  total,
  scrollYProgress,
  primaryLabel,
  secondaryLabel,
}: ProjectPanelProps) {
  const [hasAnimated, setHasAnimated] = useState(false);
  const isLast = index === total - 1;
  const { inputRange, opacityRange, scaleRange, yRange } = getPanelScrollRange(
    index,
    total,
    isLast,
  );

  const opacity = useTransform(scrollYProgress, inputRange, opacityRange);
  const pointerEvents = useTransform(opacity, (o) =>
    o > 0.5 ? 'auto' : 'none',
  );
  const scale = useTransform(scrollYProgress, inputRange, scaleRange);
  const y = useTransform(scrollYProgress, inputRange, yRange);

  useEffect(() => {
    const unsubscribe = opacity.on('change', (value) => {
      if (value > 0.9 && !hasAnimated) {
        setHasAnimated(true);
      }
    });

    return () => unsubscribe();
  }, [opacity, hasAnimated]);

  return (
    <motion.div
      className='absolute inset-0 flex items-start justify-center pt-10 overflow-hidden'
      style={{
        zIndex: total - index,
        opacity,
        scale,
        y,
        pointerEvents,
      }}
    >
      <motion.div
        variants={containerVariants}
        initial='hidden'
        animate={hasAnimated ? 'visible' : 'hidden'}
      >
        <ProjectCard
          title={item.title}
          description={item.description}
          tags={item.tags}
          projectUrl={item.projectUrl}
          githubUrl={item.githubUrl}
          primaryLabel={primaryLabel}
          secondaryLabel={secondaryLabel}
        />
      </motion.div>
    </motion.div>
  );
}
