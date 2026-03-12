import { useTranslations } from 'next-intl';

import { techStack } from '@/content/techStack';


export default function TechStack() {
  const t = useTranslations('techStack');

  return (
    <section id='tools' className='section-block'>
      <div className='mx-auto w-full max-w-5xl px-4 py-10 sm:px-6'>
        <div className='mb-4 flex flex-col items-center'>
          <p className='text-center font-mono-var text-[11px] uppercase tracking-[0.22em] text-fg/60'>
            {t('overline')}
          </p>
          <span className='mt-2 h-px w-10 bg-primary/70'></span>
        </div>
        <h2 className='text-center text-xl font-semibold sm:text-2xl'>
          {t('title')}
        </h2>
        <div className='mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-3 md:grid-cols-5'>
          {techStack.map((tech) => (
            <div
              key={tech.name}
              className='surface-card flex flex-col items-center justify-center gap-2 rounded-lg bg-surface/50 px-3 py-3 text-center text-xs sm:text-sm transition-transform duration-200 hover:-translate-y-0.5'
            >
              <span
                aria-label={tech.name}
                role='img'
                className={`tech-icon tech-${tech.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`}
                style={{
                  WebkitMaskImage: `url(${tech.icon})`,
                  maskImage: `url(${tech.icon})`,
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                }}
              />
              <span>{tech.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
