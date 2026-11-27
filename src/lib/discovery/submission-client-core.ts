import type {
  DiscoveryDraftFlushResult,
} from './draft-persistence-core';
import type {
  DiscoveryQuestionnaireAnswers,
  DiscoveryQuestionnaireErrors,
} from './questionnaire-core';
import type { DiscoverySubmissionConfirmation } from './draft-contract';

export type DiscoverySubmissionPayload = {
  answers: DiscoveryQuestionnaireAnswers;
  expectedRevision: number;
  locale: 'en' | 'it';
  schemaVersion: '2.0';
  submissionId: string;
};

export type DiscoverySubmissionTransportResult =
  | { kind: 'confirmed'; confirmation: DiscoverySubmissionConfirmation }
  | { kind: 'validation'; errors: DiscoveryQuestionnaireErrors }
  | { kind: 'conflict'; revision: number }
  | { kind: 'mutation-conflict' | 'retryable' | 'unauthorized' };

export type DiscoverySubmissionClientStatus =
  | 'ambiguous'
  | 'confirmed'
  | 'flushing'
  | 'idle'
  | 'idempotency-conflict'
  | 'offline'
  | 'revision-conflict'
  | 'submitting'
  | 'unavailable'
  | 'validation-error';

export type DiscoverySubmissionClientState = {
  confirmation: DiscoverySubmissionConfirmation | null;
  errors: DiscoveryQuestionnaireErrors;
  status: DiscoverySubmissionClientStatus;
};

type ControllerOptions = {
  createSubmissionId(): string;
  flush(): Promise<DiscoveryDraftFlushResult>;
  isOnline(): boolean;
  markSubmitted(confirmation: DiscoverySubmissionConfirmation): void;
  transport: {
    submit(payload: DiscoverySubmissionPayload): Promise<DiscoverySubmissionTransportResult>;
  };
};

export function createDiscoverySubmissionClientController(options: ControllerOptions) {
  let state: DiscoverySubmissionClientState = {
    confirmation: null,
    errors: {},
    status: 'idle',
  };
  let attempt: DiscoverySubmissionPayload | null = null;
  let pendingLocale: 'en' | 'it' | null = null;
  let inFlight: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  const publish = (next: Partial<DiscoverySubmissionClientState>) => {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  };

  const executeAttempt = async () => {
    if (!attempt) return;
    if (!options.isOnline()) {
      publish({ status: 'offline' });
      return;
    }
    publish({ errors: {}, status: 'submitting' });
    let result: DiscoverySubmissionTransportResult;
    try {
      result = await options.transport.submit(attempt);
    } catch {
      publish({ status: options.isOnline() ? 'ambiguous' : 'offline' });
      return;
    }
    if (result.kind === 'confirmed') {
      attempt = null;
      options.markSubmitted(result.confirmation);
      publish({ confirmation: result.confirmation, status: 'confirmed' });
      return;
    }
    if (result.kind === 'validation') {
      attempt = null;
      publish({ errors: result.errors, status: 'validation-error' });
      return;
    }
    if (result.kind === 'conflict') {
      attempt = null;
      publish({ status: 'revision-conflict' });
      return;
    }
    if (result.kind === 'mutation-conflict') {
      attempt = null;
      publish({ status: 'idempotency-conflict' });
      return;
    }
    if (result.kind === 'unauthorized') {
      attempt = null;
      publish({ status: 'unavailable' });
      return;
    }
    publish({ status: options.isOnline() ? 'ambiguous' : 'offline' });
  };

  const runOnce = (operation: () => Promise<void>) => {
    if (inFlight) return inFlight;
    inFlight = operation().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  const prepareAndExecute = async (locale: 'en' | 'it') => {
    if (!attempt) {
      publish({ errors: {}, status: 'flushing' });
      const flushed = await options.flush();
      if (flushed.kind !== 'acknowledged') {
        publish({
          status: flushed.kind === 'offline'
            ? 'offline'
            : flushed.kind === 'conflict'
              ? 'revision-conflict'
              : flushed.kind === 'retryable'
                ? 'ambiguous'
                : 'unavailable',
        });
        return;
      }
      attempt = {
        answers: flushed.draft.answers,
        expectedRevision: flushed.draft.revision,
        locale,
        schemaVersion: '2.0',
        submissionId: options.createSubmissionId(),
      };
    }
    await executeAttempt();
  };

  return {
    getState() {
      return state;
    },
    retry() {
      if (
        !pendingLocale ||
        (state.status !== 'ambiguous' && state.status !== 'offline')
      ) {
        return Promise.resolve();
      }
      return runOnce(() => prepareAndExecute(pendingLocale!));
    },
    submit(input: {
      clientErrors: DiscoveryQuestionnaireErrors;
      locale: 'en' | 'it';
    }) {
      if (Object.keys(input.clientErrors).length > 0) {
        publish({ errors: input.clientErrors, status: 'validation-error' });
        return Promise.resolve();
      }
      pendingLocale = input.locale;
      return runOnce(() => prepareAndExecute(input.locale));
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type DiscoverySubmissionClientController = ReturnType<
  typeof createDiscoverySubmissionClientController
>;
