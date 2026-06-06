'use client';

/**
 * ProjectPanel
 *
 * Purpose:
 * Wraps a single featured project inside the desktop pinned-scroll stage.
 *
 * Context:
 * Used only by `FeaturedProjects` on desktop-sized layouts.
 *
 * Dependencies:
 * - Framer Motion motion values from the parent sticky stage
 * - `ProjectCard` for the actual project content
 *
 * Notes:
 * - Keep the scroll mapping logic here so `ProjectCard` stays reusable outside the pinned experience.
 * - `renderContent` exists to support the final non-project explore panel without duplicating stage logic.
 */
import {
  motion,
  useTransform,
  useSpring,
  type MotionValue,
  type Variants,
} from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import ProjectCard from '@/components/projects/ProjectCard';
import { type Project as ProjectItem } from '@/lib/getProjects';

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
  // Divide the full sticky stage into equal segments, then soften each panel's entry/exit window.
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
    yRange: isLast ? [60, 10, 0] : [60, 10, 0, -20],
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
  const [showContent, setShowContent] = useState(false);
  const hasTriggeredRef = useRef(false);

  const isLast = index === total - 1;
  const { inputRange, opacityRange, scaleRange, yRange } = getPanelScrollRange(
    index,
    total,
    isLast,
  );

  const rawOpacity = useTransform(scrollYProgress, inputRange, opacityRange);

  useEffect(() => {
    // Reveal inner content once the panel is meaningfully visible, then leave it mounted.
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

  return (
    <motion.div
      className={`absolute inset-0 flex items-start justify-center overflow-hidden ${
        isLast ? 'pt-16 lg:pt-24 xl:pt-32 2xl:pt-48' : 'pt-10'
      }`}
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
            tags={item!.techStack ?? []}
            projectUrl={item!.projectUrl}
            githubUrl={item!.githubUrl}
            previewType={item!.previewType}
            hasFullPreview={item!.hasFullPreview}
            primaryLabel={primaryLabel}
            secondaryLabel={secondaryLabel}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
