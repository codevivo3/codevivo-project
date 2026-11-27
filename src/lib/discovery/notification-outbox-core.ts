export const DISCOVERY_OUTBOX_MAX_ATTEMPTS = 5;
export const DISCOVERY_OUTBOX_BATCH_SIZE = 20;
export const DISCOVERY_OUTBOX_CONCURRENCY = 3;
export const DISCOVERY_OUTBOX_LEASE_MS = 10 * 60 * 1_000;
export const DISCOVERY_OUTBOX_MAX_BACKOFF_MS = 60 * 60 * 1_000;

export type DiscoveryNotificationFailureCategory =
  | 'ambiguous-provider-outcome'
  | 'invalid-configuration'
  | 'permanent-provider-failure'
  | 'provider-idempotency-conflict'
  | 'provider-idempotency-in-progress'
  | 'provider-rate-limit'
  | 'temporary-provider-failure';

export interface ClaimedDiscoveryNotification {
  attemptCount: number;
  briefId: string;
  clientEmail: string;
  clientName: string;
  eventId: string;
  eventType: 'project_brief_submitted';
  idempotencyKey: string;
  locale: 'en' | 'it';
  submissionReference: string;
  submittedAt: Date;
}

export class DiscoveryNotificationDeliveryError extends Error {
  readonly category: DiscoveryNotificationFailureCategory;

  constructor(category: DiscoveryNotificationFailureCategory) {
    super('Discovery notification delivery failed');
    this.name = 'DiscoveryNotificationDeliveryError';
    this.category = category;
  }
}

export class DiscoveryOutboxDispatchError extends Error {
  readonly code = 'database-unavailable';

  constructor() {
    super('Discovery notification dispatch is temporarily unavailable');
    this.name = 'DiscoveryOutboxDispatchError';
  }
}

export interface DiscoveryNotificationSender {
  send(event: ClaimedDiscoveryNotification): Promise<{
    providerMessageId: string;
  }>;
}

export interface DiscoveryOutboxRepository {
  claimEligible(input: {
    batchSize: number;
    leaseExpiredBefore: Date;
    maxAttempts: number;
  }): Promise<ClaimedDiscoveryNotification[]>;
  markDelivered(input: {
    attemptCount: number;
    eventId: string;
    providerMessageId: string;
  }): Promise<boolean>;
  markFailed(input: {
    attemptCount: number;
    errorCode: DiscoveryNotificationFailureCategory;
    eventId: string;
    nextAttemptAt: Date | null;
  }): Promise<boolean>;
}

export interface DiscoveryOutboxDispatchSummary {
  ambiguousOutcomes: number;
  claimed: number;
  databaseFailures: number;
  permanentFailures: number;
  retriesScheduled: number;
  sent: number;
  staleClaims: number;
}

export interface DiscoveryOutboxDispatcher {
  dispatchBatch(): Promise<DiscoveryOutboxDispatchSummary>;
}

export function discoveryOutboxBackoffMs(attemptCount: number): number {
  return Math.min(
    60_000 * (2 ** Math.max(0, attemptCount - 1)),
    DISCOVERY_OUTBOX_MAX_BACKOFF_MS,
  );
}

function failureCategory(error: unknown): DiscoveryNotificationFailureCategory {
  return error instanceof DiscoveryNotificationDeliveryError
    ? error.category
    : 'ambiguous-provider-outcome';
}

function isRetryable(category: DiscoveryNotificationFailureCategory): boolean {
  return [
    'ambiguous-provider-outcome',
    'provider-idempotency-in-progress',
    'provider-rate-limit',
    'temporary-provider-failure',
  ].includes(category);
}

async function runWithConcurrency<T>(
  values: T[],
  concurrency: number,
  operation: (value: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        await operation(values[index]);
      }
    },
  );
  await Promise.all(workers);
}

export function createDiscoveryOutboxDispatcher(
  repository: DiscoveryOutboxRepository,
  sender: DiscoveryNotificationSender,
  options: {
    batchSize?: number;
    concurrency?: number;
    leaseMs?: number;
    maxAttempts?: number;
    now?: () => Date;
  } = {},
): DiscoveryOutboxDispatcher {
  const batchSize = options.batchSize ?? DISCOVERY_OUTBOX_BATCH_SIZE;
  const concurrency = options.concurrency ?? DISCOVERY_OUTBOX_CONCURRENCY;
  const leaseMs = options.leaseMs ?? DISCOVERY_OUTBOX_LEASE_MS;
  const maxAttempts = options.maxAttempts ?? DISCOVERY_OUTBOX_MAX_ATTEMPTS;
  const now = options.now ?? (() => new Date());

  if (
    !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100
    || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10
    || !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20
    || leaseMs < 60_000
  ) {
    throw new Error('Invalid Discovery outbox dispatcher configuration');
  }

  return {
    async dispatchBatch() {
      let claimed: ClaimedDiscoveryNotification[];
      try {
        claimed = await repository.claimEligible({
          batchSize,
          leaseExpiredBefore: new Date(now().getTime() - leaseMs),
          maxAttempts,
        });
      } catch {
        throw new DiscoveryOutboxDispatchError();
      }

      const summary: DiscoveryOutboxDispatchSummary = {
        ambiguousOutcomes: 0,
        claimed: claimed.length,
        databaseFailures: 0,
        permanentFailures: 0,
        retriesScheduled: 0,
        sent: 0,
        staleClaims: 0,
      };

      await runWithConcurrency(claimed, concurrency, async (event) => {
        let providerMessageId: string;
        try {
          providerMessageId = (await sender.send(event)).providerMessageId;
        } catch (error) {
          const category = failureCategory(error);
          const retry = isRetryable(category) && event.attemptCount < maxAttempts;
          const nextAttemptAt = retry
            ? new Date(now().getTime() + discoveryOutboxBackoffMs(event.attemptCount))
            : null;
          try {
            const updated = await repository.markFailed({
              attemptCount: event.attemptCount,
              errorCode: category,
              eventId: event.eventId,
              nextAttemptAt,
            });
            if (!updated) summary.staleClaims += 1;
            else if (retry) summary.retriesScheduled += 1;
            else summary.permanentFailures += 1;
            if (category === 'ambiguous-provider-outcome') {
              summary.ambiguousOutcomes += 1;
            }
          } catch {
            summary.databaseFailures += 1;
          }
          return;
        }

        try {
          const updated = await repository.markDelivered({
            attemptCount: event.attemptCount,
            eventId: event.eventId,
            providerMessageId,
          });
          if (updated) summary.sent += 1;
          else summary.staleClaims += 1;
        } catch {
          // Provider acceptance is ambiguous until durable finalization. The
          // lease expires and retry reuses the same provider idempotency key.
          summary.ambiguousOutcomes += 1;
          summary.databaseFailures += 1;
        }
      });

      return summary;
    },
  };
}
