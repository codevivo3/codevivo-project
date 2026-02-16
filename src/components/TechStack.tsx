import { useTranslations } from 'next-intl';

export default function TechStack() {
  const t = useTranslations('techStack');
  const items = t.raw('items') as string[];

  return (
    <section id="tools" className="section-flow">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <h2 className="text-center text-xl font-semibold sm:text-2xl">
          {t('title')}
        </h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-3 md:grid-cols-5">
          {items.map((item) => (
            <div
              key={item}
              className="rounded-lg border border-border/40 bg-surface/50 px-3 py-2 text-center text-xs sm:text-sm"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
