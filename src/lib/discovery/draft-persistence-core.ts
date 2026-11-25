import type { CountryCode } from 'libphonenumber-js';
import { parseDiscoveryDateOnly } from './date-only';
import {
  validateDiscoveryDraftAnswers,
  validateDiscoveryDraftEditingState,
  type DiscoveryDraftEditingState,
} from './draft-value-validation';
import type { DiscoveryDraftSnapshot } from './draft-contract';
import type { DiscoveryQuestionnaireAnswers } from './questionnaire-core';
import type { DiscoveryQuestionnaireStep } from './questionnaire-schema';

const DATE_FIELD_IDS = [
  'preferredStartDate',
  'desiredCompletionDate',
  'expectedDate',
] as const;

export type DiscoveryQuestionnaireWorkingSnapshot = {
  answers: DiscoveryQuestionnaireAnswers;
  currentStep: DiscoveryQuestionnaireStep;
  highestStepReached: DiscoveryQuestionnaireStep;
  locale: 'en' | 'it';
  phoneCountry: CountryCode;
  phoneInput: string;
};

export type DiscoveryDraftMutationPayload = {
  answers: DiscoveryQuestionnaireAnswers;
  baseRevision: number;
  currentStep: DiscoveryQuestionnaireStep;
  editingState: DiscoveryDraftEditingState;
  highestStepReached: DiscoveryQuestionnaireStep;
  locale: 'en' | 'it';
  mutationId: string;
  schemaVersion: '2.0';
};

export type DiscoveryDraftTransportResult =
  | { kind: 'disabled' | 'missing' | 'mutation-conflict' | 'submitted' | 'unauthorized' }
  | { kind: 'draft'; outcome: 'available' | 'created' | 'replayed' | 'updated'; draft: DiscoveryDraftSnapshot }
  | { kind: 'conflict'; draft: DiscoveryDraftSnapshot }
  | { kind: 'invalid' | 'retryable' };

export type DiscoveryDraftTransport = {
  initialize(locale: 'en' | 'it'): Promise<DiscoveryDraftTransportResult>;
  load(): Promise<DiscoveryDraftTransportResult>;
  update(payload: DiscoveryDraftMutationPayload): Promise<DiscoveryDraftTransportResult>;
};

export type DiscoveryPersistenceStatus =
  | 'conflict'
  | 'disabled'
  | 'error'
  | 'initializing'
  | 'offline'
  | 'saved'
  | 'saving'
  | 'unavailable'
  | 'unsaved';

export type DiscoveryDraftPersistenceState = {
  canRetry: boolean;
  conflict: DiscoveryDraftSnapshot | null;
  hydration: DiscoveryQuestionnaireWorkingSnapshot | null;
  hydrationVersion: number;
  ready: boolean;
  status: DiscoveryPersistenceStatus;
};

type PendingMutation = {
  payload: DiscoveryDraftMutationPayload;
  snapshotKey: string;
};

type Scheduler = {
  clear(handle: ReturnType<typeof setTimeout>): void;
  set(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
};

type ControllerOptions = {
  createMutationId(): string;
  debounceMs?: number;
  isOnline?(): boolean;
  scheduler?: Scheduler;
  transport: DiscoveryDraftTransport;
};

const defaultScheduler: Scheduler = {
  clear: (handle) => clearTimeout(handle),
  set: (callback, delay) => setTimeout(callback, delay),
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function serializeDiscoveryWorkingSnapshot(
  snapshot: DiscoveryQuestionnaireWorkingSnapshot,
): Omit<DiscoveryDraftMutationPayload, 'baseRevision' | 'mutationId' | 'schemaVersion'> {
  const answers = { ...snapshot.answers };
  const editingState: DiscoveryDraftEditingState = {
    phoneCountry: snapshot.phoneCountry,
    phoneInput: snapshot.phoneInput,
  };

  for (const fieldId of DATE_FIELD_IDS) {
    const value = String(answers[fieldId] ?? '');
    if (value && parseDiscoveryDateOnly(value) === null) {
      editingState[fieldId] = value;
      answers[fieldId] = '';
    }
  }

  return {
    answers: validateDiscoveryDraftAnswers(answers),
    currentStep: snapshot.currentStep,
    editingState: validateDiscoveryDraftEditingState(editingState),
    highestStepReached: snapshot.highestStepReached,
    locale: snapshot.locale,
  };
}

export function hydrateDiscoveryWorkingSnapshot(
  draft: DiscoveryDraftSnapshot,
): DiscoveryQuestionnaireWorkingSnapshot {
  const answers = { ...draft.answers };
  for (const fieldId of DATE_FIELD_IDS) {
    const editingValue = draft.editingState[fieldId];
    if (editingValue !== undefined) answers[fieldId] = editingValue;
  }
  return {
    answers,
    currentStep: draft.currentStep,
    highestStepReached: draft.highestStepReached,
    locale: draft.locale,
    phoneCountry: (draft.editingState.phoneCountry ?? 'IT') as CountryCode,
    phoneInput: draft.editingState.phoneInput ?? String(draft.answers.phone ?? ''),
  };
}

function workingSnapshotKey(snapshot: DiscoveryQuestionnaireWorkingSnapshot): string {
  return canonicalJson(serializeDiscoveryWorkingSnapshot(snapshot));
}

export function createDiscoveryDraftPersistenceController(options: ControllerOptions) {
  const scheduler = options.scheduler ?? defaultScheduler;
  const listeners = new Set<() => void>();
  let state: DiscoveryDraftPersistenceState = {
    canRetry: false,
    conflict: null,
    hydration: null,
    hydrationVersion: 0,
    ready: false,
    status: 'initializing',
  };
  let acknowledged: DiscoveryDraftSnapshot | null = null;
  let working: DiscoveryQuestionnaireWorkingSnapshot | null = null;
  let workingKey = '';
  let acknowledgedKey = '';
  let pending: PendingMutation | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let started = false;
  let stopped = false;
  let bootstrapPromise: Promise<void> | null = null;

  const publish = (next: Partial<DiscoveryDraftPersistenceState>) => {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  };

  const clearTimer = () => {
    if (timer !== null) scheduler.clear(timer);
    timer = null;
  };

  const applyDraft = (draft: DiscoveryDraftSnapshot) => {
    acknowledged = draft;
    const hydrated = hydrateDiscoveryWorkingSnapshot(draft);
    working = hydrated;
    workingKey = workingSnapshotKey(hydrated);
    acknowledgedKey = workingKey;
    pending = null;
    publish({
      canRetry: false,
      conflict: null,
      hydration: hydrated,
      hydrationVersion: state.hydrationVersion + 1,
      ready: true,
      status: 'saved',
    });
  };

  const bootstrap = async (locale: 'en' | 'it') => {
    publish({ canRetry: false, status: 'initializing' });
    try {
      let result = await options.transport.load();
      if (result.kind === 'missing') result = await options.transport.initialize(locale);
      if (stopped) return;
      if (result.kind === 'draft') {
        applyDraft(result.draft);
        return;
      }
      if (result.kind === 'disabled') {
        publish({ canRetry: false, ready: true, status: 'disabled' });
        return;
      }
      if (result.kind === 'unauthorized' || result.kind === 'submitted') {
        publish({ canRetry: false, ready: false, status: 'unavailable' });
        return;
      }
      publish({
        canRetry: result.kind === 'retryable',
        ready: false,
        status: result.kind === 'retryable' ? 'error' : 'unavailable',
      });
    } catch {
      if (!stopped) {
        publish({
          canRetry: true,
          ready: false,
          status: options.isOnline?.() === false ? 'offline' : 'error',
        });
      }
    }
  };

  const schedule = (delay: number) => {
    clearTimer();
    timer = scheduler.set(() => {
      timer = null;
      void send();
    }, delay);
  };

  const makePending = (): PendingMutation | null => {
    if (!working || !acknowledged) return null;
    const serialized = serializeDiscoveryWorkingSnapshot(working);
    return {
      payload: {
        ...serialized,
        baseRevision: acknowledged.revision,
        mutationId: options.createMutationId(),
        schemaVersion: '2.0',
      },
      snapshotKey: workingKey,
    };
  };

  async function send() {
    if (
      stopped ||
      inFlight ||
      state.status === 'conflict' ||
      state.status === 'disabled' ||
      state.status === 'initializing' ||
      state.status === 'unavailable'
    ) {
      return;
    }
    if (!pending) pending = makePending();
    if (!pending) return;

    const sent = pending;
    inFlight = true;
    publish({ canRetry: false, status: 'saving' });
    try {
      const result = await options.transport.update(sent.payload);
      if (stopped) return;
      if (result.kind === 'draft') {
        acknowledged = result.draft;
        acknowledgedKey = sent.snapshotKey;
        if (pending === sent) pending = null;
        inFlight = false;
        if (workingKey !== acknowledgedKey) {
          publish({ canRetry: false, status: 'unsaved' });
          schedule(0);
        } else {
          publish({ canRetry: false, status: 'saved' });
        }
        return;
      }
      if (result.kind === 'conflict') {
        inFlight = false;
        publish({
          canRetry: false,
          conflict: result.draft,
          status: 'conflict',
        });
        return;
      }
      if (result.kind === 'unauthorized' || result.kind === 'submitted') {
        inFlight = false;
        pending = null;
        publish({ canRetry: false, ready: false, status: 'unavailable' });
        return;
      }
      inFlight = false;
      publish({
        canRetry: result.kind === 'retryable',
        status: result.kind === 'retryable' || result.kind === 'mutation-conflict'
          ? 'error'
          : 'unavailable',
      });
    } catch {
      inFlight = false;
      publish({
        canRetry: true,
        status: options.isOnline?.() === false ? 'offline' : 'error',
      });
    }
  }

  return {
    destroy() {
      stopped = true;
      clearTimer();
      listeners.clear();
    },
    flush() {
      if (state.status === 'unsaved') {
        clearTimer();
        void send();
      }
    },
    getState() {
      return state;
    },
    resolveConflict() {
      if (state.status !== 'conflict' || !state.conflict) return;
      applyDraft(state.conflict);
    },
    retry() {
      if (!state.canRetry) return;
      if (!acknowledged) {
        bootstrapPromise = bootstrap(working?.locale ?? 'en');
        return;
      }
      void send();
    },
    setWorkingSnapshot(snapshot: DiscoveryQuestionnaireWorkingSnapshot, immediate = false) {
      working = snapshot;
      workingKey = workingSnapshotKey(snapshot);
      if (state.status === 'disabled' || state.status === 'initializing') return;
      if (
        state.status === 'conflict' ||
        state.status === 'unavailable'
      ) {
        return;
      }
      if (workingKey === acknowledgedKey) {
        if (!inFlight && !pending) {
          clearTimer();
          publish({ canRetry: false, status: 'saved' });
        }
        return;
      }
      // An ambiguous failure retains its immutable pending mutation. Newer edits
      // remain queued in `working` and must not replace or disable that retry.
      if ((state.status === 'error' || state.status === 'offline') && pending) {
        return;
      }
      publish({ canRetry: false, status: inFlight ? 'saving' : 'unsaved' });
      if (!inFlight) schedule(immediate ? 0 : (options.debounceMs ?? 1_000));
    },
    start(locale: 'en' | 'it', initial: DiscoveryQuestionnaireWorkingSnapshot) {
      if (started) return bootstrapPromise ?? Promise.resolve();
      started = true;
      working = initial;
      workingKey = workingSnapshotKey(initial);
      bootstrapPromise = bootstrap(locale);
      return bootstrapPromise;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type DiscoveryDraftPersistenceController = ReturnType<
  typeof createDiscoveryDraftPersistenceController
>;
