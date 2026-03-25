/**
 * Hero
 *
 * Purpose:
 * Renders the homepage hero copy, main CTA, and brand artwork.
 *
 * Context:
 * First section on the localized homepage.
 *
 * Dependencies:
 * - next-intl for localized copy
 * - shared `Button` CTA styling
 * - static brand asset in `/public/logos`
 *
 * Notes:
 * - Keep the hero ID stable because header/footer links scroll to it.
 * - The artwork is intentionally static here for layout predictability.
 */
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Button from '@/components/ui/Button';

export default function Hero() {
  // Retrieve localized strings from next-intl messages (DO NOT hardcode text).
  const t = useTranslations('hero');
  return (
    <section id='hero' className='section-block'>
      <div
        className='section-reveal mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col justify-center gap-6 px-4 py-16 sm:px-6 md:-translate-y-6 md:min-h-0 md:flex-row md:items-center md:justify-between md:gap-10 md:py-0'
        style={{ ['--reveal-delay' as string]: '0ms' }}
      >
        <div className='mx-auto w-full max-w-2xl text-center md:mx-0 md:max-w-xl md:text-left'>
          <p className='mb-3 text-xs uppercase tracking-[0.2em] text-fg/70 font-mono-var'>
            {t('eyebrow')}
          </p>
          <h1 className='text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-tight'>
            {t('title')}
          </h1>
          <p className='whitespace-pre-line mt-4 text-sm sm:text-base text-fg/72'>
            {t('subtitle')}
          </p>
          <p className='mt-4 text-sm font-medium text-fg/84 sm:text-base'>
            {t('story')}
          </p>
          <div className='mt-6 flex justify-center md:mt-8 md:justify-start'>
            <Button href='/projects'>{t('cta')}</Button>
          </div>
        </div>
        <div className='mx-auto flex w-full max-w-[290px] items-center justify-center md:mx-0 md:max-w-[360px] lg:max-w-[420px]'>
          <Image
            src='/logos/codevivo/codevivo-icon-color.svg'
            alt='Hero Logo'
            width={300}
            height={300}
            className='hero-logo-float h-auto w-full'
          />
        </div>
      </div>
    </section>
  );
}
