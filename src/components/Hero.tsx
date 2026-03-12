import { useTranslations } from 'next-intl';
import Image from 'next/image';

// import HeroLogo3D from './HeroLogo3D';
import ButtonBlue from './buttons/ButtonBlue';

export default function Hero() {
  const t = useTranslations('hero');

  return (
    <section id='hero' className='section-block'>
      <div className='mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 sm:px-6 md:flex-row md:items-center md:justify-between -translate-y-6'>
        <div className='max-w-xl text-center md:text-left'>
          <p className='mb-3 text-xs uppercase tracking-[0.2em] text-fg/70 font-mono-var'>
            {t('eyebrow')}
          </p>
          <h1 className='text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-tight'>
            {t('title')}
          </h1>
          <p className='mt-4 text-sm sm:text-base text-fg/70'>
            {t('subtitle')}
          </p>
          <div className='mt-8 flex justify-center md:justify-start'>
            <ButtonBlue href='/projects'>{t('cta')}</ButtonBlue>
          </div>
        </div>
        <div className='flex items-center justify-center'>
          {/* <HeroLogo3D /> */}
          <Image
            src='/logos/codevivo-icon-color.svg'
            alt='Hero Logo'
            width={300}
            height={300}
          />
        </div>
      </div>
    </section>
  );
}
