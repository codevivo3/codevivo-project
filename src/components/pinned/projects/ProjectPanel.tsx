'use client';

import {
  motion,
  useTransform,
  useSpring,
  type MotionValue,
  type Variants,
} from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import ProjectCard from '@/components/projects/ProjectCard';
import { type PreviewType } from '@/components/projects/ProjectThumbnail';
import { type TechId } from '@/data/techStack';

/**
 * ProjectPanel
 *
 * Wraps a single pinned project card inside the desktop sticky-scroll stage.
 *
 * Behavior:
 * - Large screens: scroll progress drives panel opacity, scale, and vertical movement
 * - Medium/small screens: this component is not used; `FeaturedProjects` renders static cards instead
 *
 * Notes:
 * - `showContent` is derived from the panel's existing opacity motion value
 * - The parent panel remains responsible for the outer fade/position transforms
 * - The inner card must keep its own layout intact; this file should not introduce clipping hacks
 */

export type ProjectItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: TechId[];
  projectUrl: string;
  githubUrl: string;
  previewType?: PreviewType;
};

type ProjectPanelProps = {
  item: ProjectItem | null;
  index: number;
  total: number;
  scrollYProgress: MotionValue<number>;
  primaryLabel: string;
  secondaryLabel: string;
  renderContent?: React.ReactNode;
};

const containerVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
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
  renderContent,
}: ProjectPanelProps) {
  // State & refs
  const [showContent, setShowContent] = useState(false);
  const hasTriggeredRef = useRef(false);

  // Responsive scroll mapping
  const isLast = index === total - 1;
  const { inputRange, opacityRange, scaleRange, yRange } = getPanelScrollRange(
    index,
    total,
    isLast,
  );

  // Animation values
  const rawOpacity = useTransform(scrollYProgress, inputRange, opacityRange);

  // Effects
  useEffect(() => {
    const unsubscribe = rawOpacity.on('change', (value) => {
      if (value > 0.6 && !hasTriggeredRef.current) {
        hasTriggeredRef.current = true;

        requestAnimationFrame(() => {
          setShowContent(true);
        });
      }
    });

    return () => unsubscribe();
  }, [rawOpacity]);

  const opacity = useSpring(rawOpacity, {
    stiffness: 200,
    damping: 25,
  });
  const pointerEvents = useTransform(opacity, (o) =>
    o > 0.5 ? 'auto' : 'none',
  );
  const scale = useTransform(scrollYProgress, inputRange, scaleRange);
  const y = useTransform(scrollYProgress, inputRange, yRange);

  // Render
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
        animate='visible'
      >
        {renderContent ?? (
          <ProjectCard
            animateIn={showContent}
            slug={item!.slug}
            title={item!.title}
            description={item!.description}
            tags={item!.tags}
            projectUrl={item!.projectUrl}
            githubUrl={item!.githubUrl}
            previewType={item!.previewType}
            primaryLabel={primaryLabel}
            secondaryLabel={secondaryLabel}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
