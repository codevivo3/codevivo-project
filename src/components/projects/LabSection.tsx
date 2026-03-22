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
      <div className='flex gap-4 overflow-x-auto pb-4'>
        {items.map((item) => (
          <div
            key={item.id}
            className='glass-effect surface-card min-w-[220px] rounded-xl bg-[var(--panel-bg)] p-4 transition-all duration-200 hover:border-primary/50'
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
