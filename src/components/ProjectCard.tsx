import Button from '@/components/ui/Button';
import ProjectThumbnail, {
  type PreviewType,
} from '@/components/projects/ProjectThumbnail';
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
  'surface-card mx-auto w-[48rem] max-w-full rounded-xl backdrop-blur-md bg-surface/60 p-4';
const tagsClassName = 'flex items-center gap-3';
const tagClassName = 'group flex items-center justify-center';
const buttonsClassName = 'flex items-center gap-4';

type ProjectCardProps = {
  title: string;
  description: string;
  tags: TechId[];
  primaryLabel: string;
  secondaryLabel: string;
  projectUrl: string;
  githubUrl: string;
  previewType?: PreviewType;
};

export default function ProjectCard({
  title,
  description,
  tags,
  primaryLabel,
  secondaryLabel,
  projectUrl,
  githubUrl,
  previewType = 'desktop',
}: ProjectCardProps) {
  const projectSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const previewPaths =
    projectSlug === 'the-paguro-journey'
      ? {
          previewImage: '/projects/paguro/preview.png',
          previewImageLeft: '/projects/paguro/mobile-left.png',
          previewImageCenter: '/projects/paguro/mobile-center.png',
          previewImageRight: '/projects/paguro/mobile-right.png',
          fullPreview: '/projects/paguro/full.png',
        }
      : projectSlug === 'project-2'
        ? {
            previewImage: '/projects/project-2/preview.png',
            previewImageLeft: undefined,
            previewImageCenter: undefined,
            previewImageRight: undefined,
            fullPreview: `/projects/${projectSlug}-full.png`,
          }
        : projectSlug === 'project-3'
          ? {
              previewImage: '/projects/project-3/mobile-center.png',
              previewImageLeft: '/projects/project-3/mobile-left.png',
              previewImageCenter: '/projects/project-3/mobile-center.png',
              previewImageRight: '/projects/project-3/mobile-right.png',
              fullPreview: `/projects/${projectSlug}-full.png`,
            }
          : {
              previewImage: `/projects/${projectSlug}-preview.png`,
              previewImageLeft: undefined,
              previewImageCenter: undefined,
              previewImageRight: undefined,
              fullPreview: `/projects/${projectSlug}-full.png`,
            };

  return (
    <article className={cardClassName}>
      <div className='grid h-[260px] grid-cols-[1.1fr_420px] items-stretch gap-6'>
        <div className='flex h-full flex-col justify-between py-4'>
          <div>
            <h3 className='text-2xl font-semibold'>{title}</h3>
            <div className='mt-3'>
              <p className='text-sm leading-relaxed text-fg/70'>
                {description}
              </p>
            </div>
          </div>
          <div>
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
            <div className={`${buttonsClassName} mt-6`}>
              <Button href={projectUrl} variant='primary'>
                {primaryLabel}
              </Button>
              <Button href={githubUrl} variant='accent'>
                {secondaryLabel}
              </Button>
            </div>
          </div>
        </div>
        <div className='flex h-full items-center justify-center'>
          <div className='aspect-[16/9] w-full max-w-[420px] overflow-visible rounded-md transition-all duration-300 ease-out group-hover:scale-[1.02]'>
            <ProjectThumbnail
              title={title}
              previewImage={previewPaths.previewImage}
              previewImageLeft={previewPaths.previewImageLeft}
              previewImageCenter={previewPaths.previewImageCenter}
              previewImageRight={previewPaths.previewImageRight}
              fullPreview={previewPaths.fullPreview}
              previewType={previewType}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
