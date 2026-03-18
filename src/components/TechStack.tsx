import { useTranslations } from 'next-intl';

import TechIcon from '@/components/ui/TechIcon';
import { techStackEntries } from '@/data/techStack';

/**
 * TechStack
 *
 * Section component used to present the technologies in the stack.
 * Technology metadata comes from src/data/techStack.ts, while icon
 * rendering is delegated to the shared TechIcon UI component.
 */

export default function TechStack() {
  const t = useTranslations('techStack');
  const overline = t.has('overline') ? t('overline') : t('title');
  const intro = t.has('intro') ? t('intro') : '';

  return (
    <section id='tools' className='section-block'>
      <div
        className='section-reveal mx-auto w-full max-w-3xl px-4 py-10 sm:px-6'
        style={{ ['--reveal-delay' as string]: '80ms' }}
      >
        <div className='mb-4 flex flex-col items-center'>
          <p className='text-center font-mono-var text-[11px] uppercase tracking-[0.22em] text-fg/60'>
            {overline}
          </p>
          <span className='mt-2 h-px w-10 bg-primary/70'></span>
        </div>
        <h2 className='text-center text-xl font-semibold sm:text-2xl'>
          {t('title')}
        </h2>
        {intro ? (
          <p className='mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-fg/72 sm:text-base'>
            {intro}
          </p>
        ) : null}
        <div className='mt-6 grid grid-cols-2 gap-16 sm:mt-8 sm:grid-cols-4 place-items-center p-8'>
          {techStackEntries.map(([id, tech]) => (
            <div
              key={id}
              className='flex flex-col items-center justify-center gap-3 text-center text-xs sm:text-sm transition-transform duration-200 hover:-translate-y-0.5'
            >
              <TechIcon id={id} size='md' />
              <span>{tech.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
