import Button from '@/components/ui/Button';
import TechIcon from '@/components/ui/TechIcon';
import { type TechId } from '@/data/techStack';

/**
 * ProjectCard
 *
 * Presentational component used to display a project entry.
 * Tech stack icons are rendered through the TechIcon UI component,
 * ensuring a single source of truth for icon rendering.
 */

const cardClassName =
  'surface-card mx-auto w-full max-w-3xl rounded-xl bg-surface/60 p-10 text-center';
const tagsClassName = 'mt-6 flex flex-wrap justify-center gap-4';
const tagClassName = 'group flex items-center justify-center';

type ProjectCardProps = {
  title: string;
  description: string;
  tags: TechId[];
  primaryLabel: string;
  secondaryLabel: string;
  projectUrl: string;
  githubUrl: string;
};

export default function ProjectCard({
  title,
  description,
  tags,
  primaryLabel,
  secondaryLabel,
  projectUrl,
  githubUrl,
}: ProjectCardProps) {
  return (
    <article className={cardClassName}>
      <h3 className='text-2xl font-semibold'>{title}</h3>
      <p className='mt-4 text-sm text-fg/70'>{description}</p>
      <ul className={tagsClassName} aria-label={`${title} tech stack`}>
        {tags.map((tagId) => {
          return (
            <li key={tagId} className={tagClassName}>
              <span className='transition-transform duration-150 group-hover:scale-110'>
                <TechIcon id={tagId} size='sm' />
              </span>
            </li>
          );
        })}
      </ul>
      <div className={tagsClassName}>
        <Button href={projectUrl} variant='primary'>
          {primaryLabel}
        </Button>
        <Button href={githubUrl} variant='accent'>
          {secondaryLabel}
        </Button>
      </div>
    </article>
  );
}
