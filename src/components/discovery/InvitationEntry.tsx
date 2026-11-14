'use client';

import { useLayoutEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type EntryState = 'loading' | 'unavailable' | 'expired' | 'established';

export default function InvitationEntry({
  initialSessionEstablished,
}: {
  initialSessionEstablished: boolean;
}) {
  const t = useTranslations('discovery');
  const [state, setState] = useState<EntryState>(
    initialSessionEstablished ? 'established' : 'loading',
  );

  useLayoutEffect(() => {
    if (initialSessionEstablished) return;

    const fragment = window.location.hash;
    const token = new URLSearchParams(fragment.slice(1)).get('token');
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}`,
    );
    const controller = new AbortController();

    if (!token) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) setState('unavailable');
      });
      return () => controller.abort();
    }

    void fetch('/api/discovery/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as { status?: EntryState };
        setState(
          result.status === 'established' || result.status === 'expired'
            ? result.status
            : 'unavailable',
        );
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setState('unavailable');
        }
      });

    return () => controller.abort();
  }, [initialSessionEstablished]);

  return (
    <main className='section-block flex min-h-[70vh] items-center justify-center px-6 py-24'>
      <section className='mx-auto max-w-2xl text-center' aria-live='polite'>
        <p className='mb-3 font-mono text-sm uppercase tracking-[0.2em] text-blue-600'>
          {t('overline')}
        </p>
        <h1 className='text-3xl font-semibold md:text-5xl'>{t(`${state}.title`)}</h1>
        <p className='mx-auto mt-5 max-w-xl text-base opacity-80 md:text-lg'>
          {t(`${state}.description`)}
        </p>
      </section>
    </main>
  );
}
