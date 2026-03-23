/**
 * LabSection
 *
 * Purpose:
 * Renders the lightweight lab experiment cards on the projects archive page.
 *
 * Context:
 * Used on the projects page as the short-form horizontal list above selected work.
 *
 * Dependencies:
 * - shared `surface-card` styling tokens
 * - translated item content prepared by the parent page
 *
 * Notes:
 * - Keep this section presentation-only; item filtering and ordering belong in the page layer.
 * - Horizontal overflow is intentional for smaller viewports.
 */
type LabItem = {
  id: string;
  title: string;
  description?: string;
  tag?: string;
};

type Props = {
  items: LabItem[];
  title: string;
};

export default function LabSection({ items, title }: Props) {
  return (
    <div className='mx-auto w-full max-w-5xl space-y-6'>
      <div className='mx-auto w-full max-w-4xl'>
        <h2 className='text-lg font-semibold'>{title}</h2>
      </div>
      <div className='flex w-full max-w-full flex-col gap-4 md:flex-row md:overflow-x-auto md:pb-4'>
        {items.map((item) => (
          <div
            key={item.id}
            className='glass-effect surface-card w-full min-w-0 rounded-xl bg-[var(--panel-bg)] p-4 transition-all duration-200 hover:border-primary/50 md:min-w-[220px]'
          >
            <h3 className='text-sm font-medium'>{item.title}</h3>
            {item.description ? (
              <p className='mt-2 text-xs text-fg/70'>{item.description}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
