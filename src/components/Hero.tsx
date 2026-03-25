
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
    <section id='hero' className='section-block scroll-mt-32 md:scroll-mt-32'>
      <div
        className='section-reveal mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col justify-center items-center gap-8 px-4 pt-16 pb-12 sm:px-6 md:-translate-y-6 md:min-h-0 md:flex-row md:items-center md:justify-between md:gap-10 md:py-0'
        style={{ ['--reveal-delay' as string]: '0ms' }}
      >
        <div className='mx-auto w-full max-w-2xl text-center md:mx-0 md:max-w-xl md:text-left mt-[-16vh] md:mt-0'>
          <div className='flex flex-col gap-4 md:block'>
            <h1 className='text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-tight'>
              {t('title')}
            </h1>
            <p className='whitespace-pre-line text-sm text-fg/72 sm:text-base md:mt-4'>
              {t('subtitle')}
            </p>
            <p className='text-sm font-medium text-fg/84 sm:text-base md:mt-4'>
              {t('story')}
            </p>
          </div>
          <div className='mt-14 flex justify-center md:mt-8 md:justify-start'>
            <div className='w-full max-w-[220px] md:w-auto md:max-w-none'>
              <Button href='/projects'>{t('cta')}</Button>
            </div>
          </div>
        </div>
        <div className='mx-auto mt-10 flex w-full max-w-[240px] items-center justify-center sm:max-w-[290px] md:mx-0 md:mt-0 md:max-w-[320px] lg:max-w-[380px]'>
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
