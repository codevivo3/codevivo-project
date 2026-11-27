'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { DiscoveryQuestionnairePrefill } from '@/lib/discovery/questionnaire-core';
import {
  consumeDiscoveryInvitationFragment,
  createDiscoveryInvitationExchangeLifecycle,
  type DiscoveryInvitationEntryState,
} from '@/lib/discovery/invitation-entry-core';
import { useDiscoveryQuestionnaireStateStore } from './DiscoveryQuestionnaireState';
import DiscoveryQuestionnaire from './DiscoveryQuestionnaire';

type EntryState = 'loading' | DiscoveryInvitationEntryState;

export default function InvitationEntry({
  initialSessionEstablished,
  initialPrefill,
  stateScopeId,
}: {
  initialSessionEstablished: boolean;
  initialPrefill?: DiscoveryQuestionnairePrefill;
  stateScopeId?: string;
}) {
  const t = useTranslations('discovery');
  const questionnaireState = useDiscoveryQuestionnaireStateStore();
  const [state, setState] = useState<EntryState>(
    initialSessionEstablished ? 'established' : 'loading',
  );
  const exchangeLifecycle = useRef<ReturnType<
    typeof createDiscoveryInvitationExchangeLifecycle
  > | null>(null);

  useLayoutEffect(() => {
    if (initialSessionEstablished) return;

    if (!exchangeLifecycle.current) {
      questionnaireState.clear();
      const token = consumeDiscoveryInvitationFragment({
        hash: window.location.hash,
        pathname: window.location.pathname,
        replaceState: (url) => window.history.replaceState(null, '', url),
        search: window.location.search,
      });
      exchangeLifecycle.current = createDiscoveryInvitationExchangeLifecycle({
        token,
        exchange: async (invitationToken, signal) => {
          const response = await fetch('/api/discovery/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: invitationToken }),
            cache: 'no-store',
            credentials: 'same-origin',
            signal,
          });
          const result = (await response.json()) as { status?: EntryState };
          if (result.status === 'established' || result.status === 'expired') {
            return result.status;
          }
          return 'unavailable';
        },
        onResult: (result) => {
          if (result === 'established') {
            window.location.replace(
              `${window.location.pathname}${window.location.search}`,
            );
            return;
          }
          setState(result);
        },
      });
    }

    return exchangeLifecycle.current.setup();
  }, [initialSessionEstablished, questionnaireState]);

  if (state === 'established' && stateScopeId) {
    return (
      <DiscoveryQuestionnaire
        key={stateScopeId}
        initialPrefill={initialPrefill}
        stateScopeId={stateScopeId}
      />
    );
  }

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
