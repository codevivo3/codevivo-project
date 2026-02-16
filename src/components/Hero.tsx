import { useTranslations } from 'next-intl';
import HeroLogo3D from './HeroLogo3D';

export default function Hero() {
  const t = useTranslations('hero');

  return (
    <section className='section-flow'>
      <div className='mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between md:py-16'>
        <div className='max-w-xl text-center md:text-left'>
          <p className='mb-3 text-xs uppercase tracking-[0.2em] text-fg/70'>
            {t('eyebrow')}
          </p>
          <h1 className='text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-tight'>
            {t('title')}
          </h1>
          <p className='mt-4 text-sm sm:text-base text-fg/70'>
            {t('subtitle')}
          </p>
          <div className='mt-8 flex justify-center md:justify-start'>
            <a
              href='#projects'
              className='inline-flex w-full items-center justify-center gap-2 rounded-md border border-primary bg-primary px-4 py-2 text-sm font-medium text-fg transition hover:bg-accent hover:text-fg sm:w-auto'
            >
              {t('cta')}
            </a>
          </div>
        </div>
        <div className='flex items-center justify-center'>
          <HeroLogo3D />
        </div>
      </div>
    </section>
  );
}
