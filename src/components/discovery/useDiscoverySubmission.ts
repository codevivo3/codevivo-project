'use client';

import { useSyncExternalStore } from 'react';
import type { DiscoveryQuestionnaireErrors } from '@/lib/discovery/questionnaire-core';
import {
  createDiscoverySubmissionClientController,
  type DiscoverySubmissionPayload,
  type DiscoverySubmissionTransportResult,
} from '@/lib/discovery/submission-client-core';
import type { DiscoveryDraftPersistenceController } from '@/lib/discovery/draft-persistence-core';
import { useDiscoverySubmissionController } from './DiscoveryQuestionnaireState';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function parseDiscoverySubmissionResponse(
  response: Response,
): Promise<DiscoverySubmissionTransportResult> {
  let body: Record<string, unknown> = {};
  try {
    const value = await response.json() as unknown;
    if (isRecord(value)) body = value;
  } catch {
    // Status handling remains fail closed below.
  }

  if ((response.status === 200 || response.status === 201) && body.status === 'submitted') {
    const value = body.submission;
    if (isRecord(value)) {
      const submittedAt = new Date(String(value.submittedAt ?? ''));
      if (
        typeof value.reference === 'string' &&
        value.reference.length > 0 &&
        Number.isSafeInteger(value.revision) &&
        !Number.isNaN(submittedAt.getTime())
      ) {
        return {
          kind: 'confirmed',
          confirmation: {
            reference: value.reference,
            revision: value.revision as number,
            submittedAt,
          },
        };
      }
    }
    return { kind: 'retryable' };
  }
  if (response.status === 422 && body.status === 'invalid' && isRecord(body.errors)) {
    return { kind: 'validation', errors: body.errors as DiscoveryQuestionnaireErrors };
  }
  if (
    response.status === 409 &&
    body.status === 'conflict' &&
    Number.isSafeInteger(body.revision)
  ) {
    return { kind: 'conflict', revision: body.revision as number };
  }
  if (response.status === 409 && body.status === 'mutation-conflict') {
    return { kind: 'mutation-conflict' };
  }
  if (response.status === 503 && body.status === 'disabled') {
    return { kind: 'unauthorized' };
  }
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return { kind: 'unauthorized' };
  }
  return { kind: 'retryable' };
}

async function submitPayload(
  payload: DiscoverySubmissionPayload,
): Promise<DiscoverySubmissionTransportResult> {
  const response = await fetch('/api/discovery/submission', {
    body: JSON.stringify(payload),
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  return parseDiscoverySubmissionResponse(response);
}

export function useDiscoverySubmission(input: {
  persistenceController: Pick<
    DiscoveryDraftPersistenceController,
    'flushAndWait' | 'markSubmitted'
  >;
  scopeId: string;
}) {
  const controller = useDiscoverySubmissionController(
    input.scopeId,
    () => createDiscoverySubmissionClientController({
      createSubmissionId: () => globalThis.crypto.randomUUID(),
      flush: input.persistenceController.flushAndWait,
      isOnline: () => navigator.onLine,
      markSubmitted: input.persistenceController.markSubmitted,
      transport: { submit: submitPayload },
    }),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );
  return {
    retry: controller.retry,
    state,
    submit: controller.submit,
  };
}
