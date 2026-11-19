'use client';

/**
 * ContactForm
 *
 * Purpose:
 * Renders the public contact form and connects it to the server action submission flow.
 *
 * Context:
 * Used on the homepage as the primary direct contact entry point.
 *
 * Dependencies:
 * - next-intl for localized copy
 * - `sendContactEmail` server action for submission handling
 * - Vercel analytics for simple view/submission tracking
 *
 * Notes:
 * - Keep the hidden honeypot field in place; it supports the anti-spam flow on the server.
 * - Form labels and validation text should remain message-driven.
 */
import { useActionState, useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { track } from '@vercel/analytics';
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';

import Button from '@/components/ui/Button';
import { sendContactEmail } from '@/app/contact/actions';
import {
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_EMAIL_PATTERN_SOURCE,
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_MESSAGE_MIN_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  isContactLocale,
} from '@/lib/contact/validation';
import {
  applyContactIdempotencyRotation,
  getOrCreateContactIdempotencyKey,
} from '@/lib/contact/idempotency';

function safePrivacyNoticeUrl(value: string | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function ContactForm() {
  // Retrieve localized strings from next-intl messages (DO NOT hardcode text).
  const t = useTranslations('contact');
  const activeLocale = useLocale();
  const locale = isContactLocale(activeLocale) ? activeLocale : 'en';
  const initialContactFormState = {
    success: false,
    error: null,
  };
  const [state, formAction, isPending] = useActionState(
    sendContactEmail,
    initialContactFormState,
  );
  const contentRef = useRef<HTMLDivElement | null>(null);
  const idempotencyInputRef = useRef<HTMLInputElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: contentRef,
    offset: ['start end', 'end end'],
  });
  const scrollOffset = useTransform(scrollYProgress, [0, 0.8], [18, 0]);
  const springOffset = useSpring(scrollOffset, {
    stiffness: 140,
    damping: 24,
    mass: 0.5,
  });
  const privacyNoticeUrl = safePrivacyNoticeUrl(
    locale === 'it'
      ? process.env.NEXT_PUBLIC_CONTACT_PRIVACY_NOTICE_URL_IT
      : process.env.NEXT_PUBLIC_CONTACT_PRIVACY_NOTICE_URL_EN,
  );

  useEffect(() => {
    if (idempotencyInputRef.current) {
      idempotencyInputRef.current.value =
        getOrCreateContactIdempotencyKey(window.sessionStorage);
    }
  }, []);

  useEffect(() => {
    applyContactIdempotencyRotation(
      state,
      window.sessionStorage,
      idempotencyInputRef.current,
    );
  }, [state]);

  useEffect(() => {
    track('contact_form_viewed');
  }, []);

  useEffect(() => {
    if (state.success) {
      track('contact_form_submitted');
    }
  }, [state.success]);

  return (
    <section id='contact' className='section-block'>
      <motion.div
        ref={contentRef}
        className='section-reveal relative mx-auto w-full max-w-3xl px-4 py-8 sm:px-6'
        style={{
          ['--reveal-delay' as string]: '180ms',
          y: prefersReducedMotion ? 0 : springOffset,
        }}
      >
        <div className='mb-4 flex flex-col items-center'>
          <h2 className='text-center text-xl font-semibold sm:text-2xl'>
            {t('title')}
          </h2>
          <span className='mt-2 h-px w-10 bg-primary/70 '></span>
          <p className='mx-auto mt-4 max-w-2xl text-center text-sm leading-snug text-fg/72 sm:text-base'>
            {t('intro')}
          </p>
        </div>
        <form
          className='glass-effect mt-5 rounded-xl surface-card bg-[var(--panel-bg)] p-5 sm:mt-6 sm:p-6'
          action={formAction}
        >
          <input type='hidden' name='locale' value={locale} />
          <input
            ref={idempotencyInputRef}
            type='hidden'
            name='idempotencyKey'
          />
          {/* Hidden honeypot field; legitimate users never interact with this input. */}
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
                required
                maxLength={CONTACT_NAME_MAX_LENGTH}
                aria-describedby={state.error ? 'contact-form-error' : undefined}
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
                maxLength={CONTACT_EMAIL_MAX_LENGTH}
                pattern={CONTACT_EMAIL_PATTERN_SOURCE}
                aria-describedby={state.error ? 'contact-form-error' : undefined}
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
              minLength={CONTACT_MESSAGE_MIN_LENGTH}
              maxLength={CONTACT_MESSAGE_MAX_LENGTH}
              aria-describedby={state.error ? 'contact-form-error' : undefined}
              className='brand-border min-h-[140px] border-b bg-transparent px-1 py-2 text-sm text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
              placeholder={t('messagePlaceholder')}
            />
          </label>
          {state.error ? (
            <p
              id='contact-form-error'
              role='alert'
              className='mt-4 text-sm text-red-400'
            >
              {t('error')}
            </p>
          ) : null}
          {state.success ? (
            <p role='status' className='mt-4 text-sm text-primary'>
              {t('success')}
            </p>
          ) : null}
          <div className='mt-6 flex flex-col items-center gap-4 md:items-end'>
            {privacyNoticeUrl ? (
              <a
                href={privacyNoticeUrl}
                className='text-center text-xs text-fg/70 underline decoration-fg/35 underline-offset-4 transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
              >
                {t('privacyLink')}
              </a>
            ) : null}
            <div className='w-full max-w-[220px] md:w-auto md:max-w-none'>
              <Button type='submit' disabled={isPending}>
                {isPending ? t('sending') : t('cta')}
              </Button>
            </div>
          </div>
        </form>
      </motion.div>
    </section>
  );
}
