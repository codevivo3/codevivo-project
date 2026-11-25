'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  createDiscoveryDraftPersistenceController,
  type DiscoveryDraftTransport,
  type DiscoveryDraftTransportResult,
  type DiscoveryQuestionnaireWorkingSnapshot,
} from '@/lib/discovery/draft-persistence-core';
import {
  validateDiscoveryDraftAnswers,
  validateDiscoveryDraftEditingState,
} from '@/lib/discovery/draft-value-validation';
import type { DiscoveryDraftSnapshot } from '@/lib/discovery/draft-contract';
import type { DiscoveryQuestionnaireStep } from '@/lib/discovery/questionnaire-schema';
import { useDiscoveryDraftPersistenceController } from './DiscoveryQuestionnaireState';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseDraft(value: unknown): DiscoveryDraftSnapshot | null {
  if (!isRecord(value)) return null;
  const updatedAt = new Date(String(value.updatedAt ?? ''));
  if (
    typeof value.briefId !== 'string' ||
    value.schemaVersion !== '2.0' ||
    (value.locale !== 'en' && value.locale !== 'it') ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 0 ||
    !Number.isInteger(value.currentStep) ||
    (value.currentStep as number) < 1 ||
    (value.currentStep as number) > 7 ||
    !Number.isInteger(value.highestStepReached) ||
    (value.highestStepReached as number) < (value.currentStep as number) ||
    (value.highestStepReached as number) > 7 ||
    Number.isNaN(updatedAt.getTime())
  ) {
    return null;
  }
  try {
    return {
      answers: validateDiscoveryDraftAnswers(value.answers),
      briefId: value.briefId,
      currentStep: value.currentStep as DiscoveryQuestionnaireStep,
      editingState: validateDiscoveryDraftEditingState(value.editingState),
      highestStepReached: value.highestStepReached as DiscoveryQuestionnaireStep,
      locale: value.locale,
      revision: value.revision as number,
      schemaVersion: value.schemaVersion,
      updatedAt,
    };
  } catch {
    return null;
  }
}

async function parseResponse(response: Response): Promise<DiscoveryDraftTransportResult> {
  let body: Record<string, unknown> = {};
  try {
    const value = await response.json() as unknown;
    if (isRecord(value)) body = value;
  } catch {
    // Status-based handling below remains fail closed for malformed responses.
  }

  if (response.status === 503 && body.status === 'disabled') return { kind: 'disabled' };
  if (response.status === 404 && body.status === 'missing') return { kind: 'missing' };
  if (response.status === 401 || response.status === 403) return { kind: 'unauthorized' };
  if (response.status === 409 && body.status === 'submitted') return { kind: 'submitted' };
  if (response.status === 409 && body.status === 'mutation-conflict') {
    return { kind: 'mutation-conflict' };
  }

  const draft = parseDraft(body.draft);
  if (response.status === 409 && body.status === 'conflict' && draft) {
    return { draft, kind: 'conflict' };
  }
  if (
    response.ok &&
    draft &&
    ['available', 'created', 'replayed', 'updated'].includes(String(body.status))
  ) {
    return {
      draft,
      kind: 'draft',
      outcome: body.status as 'available' | 'created' | 'replayed' | 'updated',
    };
  }
  if (response.status === 429 || response.status >= 500) return { kind: 'retryable' };
  return { kind: 'invalid' };
}

function createFetchTransport(): DiscoveryDraftTransport {
  const request = async (method: 'GET' | 'POST' | 'PUT', body?: object) => {
    const response = await fetch('/api/discovery/draft', {
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      method,
    });
    return parseResponse(response);
  };
  return {
    initialize: (locale) => request('POST', { locale }),
    load: () => request('GET'),
    update: (payload) => request('PUT', payload),
  };
}

export function useDiscoveryDraftPersistence(input: {
  flushSignal: number;
  onHydrate(snapshot: DiscoveryQuestionnaireWorkingSnapshot): void;
  scopeId: string;
  snapshot: DiscoveryQuestionnaireWorkingSnapshot;
}) {
  const { flushSignal, onHydrate, scopeId, snapshot } = input;
  const controller = useDiscoveryDraftPersistenceController(
    scopeId,
    () => createDiscoveryDraftPersistenceController({
      createMutationId: () => globalThis.crypto.randomUUID(),
      isOnline: () => navigator.onLine,
      transport: createFetchTransport(),
    }),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );
  const initialSnapshot = useRef(snapshot);
  const lastFlushSignal = useRef(flushSignal);
  const lastHydrationVersion = useRef(controller.getState().hydrationVersion);
  const skipWorkingSnapshot = useRef(false);

  useEffect(() => {
    void controller.start(
      initialSnapshot.current.locale,
      initialSnapshot.current,
    );
  }, [controller]);

  useEffect(() => {
    if (
      !state.hydration ||
      state.hydrationVersion === lastHydrationVersion.current
    ) {
      return;
    }
    lastHydrationVersion.current = state.hydrationVersion;
    skipWorkingSnapshot.current = true;
    onHydrate(state.hydration);
  }, [onHydrate, state.hydration, state.hydrationVersion]);

  useEffect(() => {
    if (skipWorkingSnapshot.current) {
      skipWorkingSnapshot.current = false;
      return;
    }
    const immediate = flushSignal !== lastFlushSignal.current;
    lastFlushSignal.current = flushSignal;
    controller.setWorkingSnapshot(snapshot, immediate);
  }, [controller, flushSignal, snapshot]);

  useEffect(() => {
    const retryWhenOnline = () => {
      if (controller.getState().status === 'offline') controller.retry();
    };
    window.addEventListener('online', retryWhenOnline);
    return () => window.removeEventListener('online', retryWhenOnline);
  }, [controller]);

  return {
    resolveConflict: controller.resolveConflict,
    retry: controller.retry,
    state,
  };
}
