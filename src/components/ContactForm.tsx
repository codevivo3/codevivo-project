'use client';

import { useActionState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { track } from '@vercel/analytics';

import Button from '@/components/ui/Button';
import { sendContactEmail } from '@/app/contact/actions';

/**
 * ContactForm
 *
 * Purpose:
 * Renders the contact section form with validation, analytics, and submission state.
 *
 * Behavior:
 * - Large screens: uses the same static form layout with responsive spacing
 * - Medium screens: keeps the same form structure without animation state dependencies
 * - Mobile: remains fully visible on first render and does not depend on parent triggers
 *
 * Notes:
 * - This component does not manage motion directly
 * - A hidden honeypot field is used to reduce spam without affecting layout
 */

export default function ContactForm() {
  // Derived values
  const t = useTranslations('contact');
  const initialContactFormState = {
    success: false,
    error: null,
  };
  const [state, formAction, isPending] = useActionState(
    sendContactEmail,
    initialContactFormState,
  );

  // Effects
  useEffect(() => {
    track('contact_form_viewed');
  }, []);

  useEffect(() => {
    if (state.success) {
      track('contact_form_submitted');
    }
  }, [state.success]);

  // Render
  return (
    <section id='contact' className='section-block'>
      <div
        className='section-reveal mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 '
        style={{ ['--reveal-delay' as string]: '180ms' }}
      >
        <div className='mb-4 flex flex-col items-center'>
          <p className='text-center font-mono-var text-[11px] uppercase tracking-[0.22em] text-fg/60'>
            {t('overline')}
          </p>
          <span className='mt-2 h-px w-10 bg-primary/70 '></span>
        </div>
        <h2 className='text-center text-xl font-semibold sm:text-2xl'>
          {t('title')}
        </h2>
        <p className='mx-auto mt-4 max-w-2xl text-center text-sm leading-snug text-fg/72 sm:text-base'>
          {t('intro')}
        </p>
        <form
          className='glass-effect mt-5 rounded-xl surface-card bg-[var(--panel-bg)] p-5 sm:mt-6 sm:p-6'
          action={formAction}
        >
          <input
            type='text'
            name='website'
            className='hidden'
            tabIndex={-1}
            autoComplete='off'
            aria-hidden='true'
          />
          <div className='grid gap-4 sm:grid-cols-2'>
            <label
              htmlFor='name'
              className='flex flex-col gap-2 text-[11px] uppercase tracking-[0.2em] text-fg/60 font-mono-var'
            >
              {t('name')}
              <input
                id='name'
                name='name'
                type='text'
                className='brand-border border-b bg-transparent px-1 py-2 text-sm text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
                placeholder={t('namePlaceholder')}
              />
            </label>
            <label
              htmlFor='email'
              className='flex flex-col gap-2 text-[11px] uppercase tracking-[0.2em] text-fg/60 font-mono-var'
            >
              {t('email')}
              <input
                id='email'
                name='email'
                type='email'
                required
                pattern='^[^\s@]+@[^\s@]+\.[^\s@]+$'
                className='brand-border border-b bg-transparent px-1 py-2 text-sm text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
                placeholder={t('emailPlaceholder')}
              />
            </label>
          </div>
          <label
            htmlFor='message'
            className='mt-4 flex flex-col gap-2 text-[11px] uppercase tracking-[0.2em] text-fg/60 font-mono-var'
          >
            {t('message')}
            <textarea
              id='message'
              name='message'
              rows={5}
              required
              minLength={20}
              className='brand-border min-h-[140px] border-b bg-transparent px-1 py-2 text-sm text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
              placeholder={t('messagePlaceholder')}
            />
          </label>
          {state.error ? (
            <p className='mt-4 text-sm text-red-400'>{t('error')}</p>
          ) : null}
          {state.success ? (
            <p className='mt-4 text-sm text-primary'>{t('success')}</p>
          ) : null}
          <div className='mt-6 flex justify-end'>
            <Button type='submit' disabled={isPending}>
              {isPending ? t('sending') : t('cta')}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
