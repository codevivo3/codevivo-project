type ProjectCardProps = {
  title: string;
  description: string;
  tags: { id: string; label: string }[];
  primaryLabel: string;
  secondaryLabel: string;
};

export default function ProjectCard({
  title,
  description,
  tags,
  primaryLabel,
  secondaryLabel,
}: ProjectCardProps) {
  return (
    <article className="rounded-xl border border-border/40 bg-surface/60 p-4 shadow-sm sm:p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-fg/70">
        {description}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="rounded-full border border-border/50 px-2 py-0.5 text-xs text-fg/70"
          >
            {tag.label}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="w-full rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-fg transition hover:bg-surface hover:text-fg sm:w-auto">
          {primaryLabel}
        </button>
        <button className="w-full rounded-md border border-border px-3 py-1.5 text-xs font-medium text-fg/70 transition hover:bg-surface sm:w-auto">
          {secondaryLabel}
        </button>
      </div>
    </article>
  );
}
