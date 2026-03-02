'use client';

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
    isLast
      ? [0, 1, 1]
      : [0, 1, 1, 0]
  );
  const pointerEvents = useTransform(opacity, (o) =>
    o > 0.5 ? 'auto' : 'none'
  );

  const scale = useTransform(
    scrollYProgress,
    isLast
      ? [start, enterPoint, exitPoint]
      : [start, enterPoint, exitPoint, end],
    isLast
      ? [0.96, 1.04, 1.04]
      : [0.96, 1.04, 1.04, 0.98]
  );

  const y = useTransform(
    scrollYProgress,
    isLast
      ? [start, enterPoint, exitPoint]
      : [start, enterPoint, exitPoint, end],
    isLast
      ? [40, 0, 0]
      : [40, 0, 0, -40]
  );

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{
        zIndex: total - index,
        opacity,
        scale,
        y,
        pointerEvents,
      }}
    >
      <article className="mx-auto w-full max-w-3xl rounded-xl bg-surface border border-primary/30 p-10 text-center">
        <p className="text-[11px] uppercase tracking-[0.22em] text-fg/60 font-mono-var">
          {overline}
        </p>
        <h3 className="mt-3 text-2xl font-semibold">{item.title}</h3>
        <p className="mt-4 text-sm text-fg/70">{item.description}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {item.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full border border-border/50 px-2 py-0.5 text-xs text-fg/70 font-mono-var"
            >
              {tag.label}
            </span>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button className="w-full cursor-pointer rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-fg transition hover:bg-surface hover:text-fg sm:w-auto">
            {primaryLabel}
          </button>
          <button className="w-full cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-medium text-fg/70 transition hover:bg-surface sm:w-auto">
            {secondaryLabel}
          </button>
        </div>
      </article>
    </motion.div>
  );
}
