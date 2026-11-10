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
 * - Preserve a single semantic H1 for SEO and accessibility.
 * - Use translated newline characters to separate the heading lines.
 * - Phones and portrait tablets use a centered, compact layout.
 * - Landscape tablets and desktops retain the horizontal composition.
 * - Allow natural vertical scrolling when the available height is limited.
 */

import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import Button from '@/components/ui/Button';

export default function Hero() {
  // Retrieve localized strings from next-intl messages (DO NOT hardcode text).
  const t = useTranslations('hero');
  const locale = useLocale();

  // Split the localized heading into lines without losing H1 semantics.
  const titleLines = t('title').split('\n');

  return (
    <section id='hero' className='section-block scroll-mt-32 md:scroll-mt-32'>
      <div
        className='section-reveal mx-auto flex min-h-[calc(100svh-1rem)] w-full max-w-5xl flex-col items-center justify-center gap-3 lg:landscape:gap-10 px-4 pt-6 pb-6 sm:px-6 md:gap-6 lg:landscape:-translate-y-6 lg:landscape:min-h-0 lg:landscape:flex-row lg:landscape:items-center lg:landscape:justify-between lg:landscape:gap-10 lg:landscape:py-0'
        style={{ ['--reveal-delay' as string]: '0ms' }}
      >
        {/* Localized hero content */}
        <div className='order-2 mx-auto w-full max-w-2xl text-center lg:landscape:order-first lg:landscape:mx-0 lg:landscape:max-w-xl lg:landscape:text-left'>
          <div className='flex flex-col gap-3 lg:landscape:block'>
            {/* Single semantic H1 with a decorative separator */}
            <h1 className='flex flex-col items-center text-center text-[clamp(1.8rem,4vw,3rem)] font-semibold leading-tight lg:landscape:items-start lg:landscape:text-left'>
              {titleLines.map((line, index) => (
                <span key={index} className='contents'>
                  {index > 0 && (
                    <span
                      aria-hidden='true'
                      className='my-3 h-[2px] w-12 rounded-full bg-primary'
                    />
                  )}
                  <span>{line}</span>
                </span>
              ))}
            </h1>

            {/* Professional introduction */}
            <p className='whitespace-pre-line text-sm text-fg/72 sm:text-base lg:landscape:mt-4'>
              {t('subtitle')}
            </p>

            {/* Audience and freelance availability */}
            <p className='whitespace-pre-line text-sm font-medium text-fg/84 sm:text-base lg:landscape:mt-4'>
              {t('story')}
            </p>
          </div>

          {/* Main CTA with canonical locale-aware routing */}
          <div className='mt-6 flex justify-center lg:landscape:mt-8 lg:landscape:justify-start'>
            <div className='w-full max-w-[220px] lg:landscape:w-auto lg:landscape:max-w-none'>
              <Button
                href={locale === 'en' ? '/projects' : `/${locale}/projects`}
              >
                {t('cta')}
              </Button>
            </div>
          </div>
        </div>

        {/* Brand artwork: compact in portrait, larger in landscape */}
        <div className='order-first mx-auto mb-3 mt-0 flex w-full max-w-[135px] items-center justify-center overflow-visible sm:max-w-[165px] md:portrait:max-w-[330px] lg:landscape:order-last lg:landscape:mx-0 lg:landscape:mb-0 lg:landscape:mt-0 lg:landscape:max-w-[320px] xl:landscape:max-w-[380px]'>
          <Image
            src='/logos/codevivo/codevivo-icon-color.svg'
            alt='CodeVivo Logo'
            width={380}
            height={380}
            className='hero-logo-float h-auto w-full'
            priority
          />
        </div>
      </div>
    </section>
  );
}
