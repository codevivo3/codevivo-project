type InProgressItem = {
  id: string;
  title: string;
  description: string;
};

type Props = {
  items: InProgressItem[];
  title: string;
};

export default function InProgressSection({ items, title }: Props) {
  return (
    <div className='space-y-6'>
      <h2 className='mx-auto w-full max-w-4xl text-lg font-semibold'>
        {title}
      </h2>
      <div className='mx-auto flex w-full max-w-4xl flex-col gap-6'>
        {items.map((item) => (
          <div
            key={item.id}
            className='glass-effect surface-card w-full rounded-xl bg-[var(--panel-bg)] p-4 transition-all duration-200 hover:border-primary/50'
          >
            <h3 className='text-sm font-medium'>{item.title}</h3>
            <p className='mt-2 text-sm text-fg/72'>{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
