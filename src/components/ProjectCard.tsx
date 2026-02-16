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
    <article className="rounded-xl border border-[color:var(--color-ash)]/40 bg-white/60 p-4 shadow-sm sm:p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-[color:var(--color-shadow)]/70">
        {description}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="rounded-full border border-[color:var(--color-ash)]/50 px-2 py-0.5 text-xs text-[color:var(--color-shadow)]/70"
          >
            {tag.label}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="w-full rounded-md border border-[color:var(--color-blue)] bg-[color:var(--color-blue)] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[color:var(--color-honeydew)] hover:text-[color:var(--color-shadow)] sm:w-auto">
          {primaryLabel}
        </button>
        <button className="w-full rounded-md border border-[color:var(--color-ash)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-shadow)]/70 transition hover:bg-[color:var(--color-honeydew)] sm:w-auto">
          {secondaryLabel}
        </button>
      </div>
    </article>
  );
}
