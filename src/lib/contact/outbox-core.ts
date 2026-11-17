export const CONTACT_OUTBOX_MAX_ATTEMPTS = 5;
export const CONTACT_OUTBOX_BATCH_SIZE = 20;
export const CONTACT_OUTBOX_CONCURRENCY = 3;
export const CONTACT_OUTBOX_LEASE_MS = 10 * 60 * 1_000;
export const CONTACT_OUTBOX_MAX_BACKOFF_MS = 60 * 60 * 1_000;

export type ContactNotificationEventType =
  | 'internal_alert'
  | 'visitor_acknowledgement';

export interface ClaimedContactNotification {
  attemptCount: number;
  email: string;
  eventId: string;
  eventType: ContactNotificationEventType;
  idempotencyKey: string;
  inquiryId: string;
  locale: 'en' | 'it';
  message: string;
  name: string;
}

export type NotificationFailureCategory =
  | 'ambiguous-provider-outcome'
  | 'invalid-configuration'
  | 'permanent-provider-failure'
  | 'provider-idempotency-conflict'
  | 'provider-idempotency-in-progress'
  | 'provider-rate-limit'
  | 'temporary-provider-failure';

export class ContactNotificationDeliveryError extends Error {
  readonly category: NotificationFailureCategory;

  constructor(category: NotificationFailureCategory) {
    super('Contact notification delivery failed');
    this.name = 'ContactNotificationDeliveryError';
    this.category = category;
  }
}

export class ContactOutboxDispatchError extends Error {
  readonly code = 'database-unavailable';

  constructor() {
    super('Contact notification dispatch is temporarily unavailable');
    this.name = 'ContactOutboxDispatchError';
  }
}

export interface ContactNotificationSender {
  send(event: ClaimedContactNotification): Promise<{
    providerMessageId: string;
  }>;
}

export interface ContactOutboxRepository {
  claimEligible(input: {
    batchSize: number;
    leaseExpiredBefore: Date;
    maxAttempts: number;
  }): Promise<ClaimedContactNotification[]>;

  markDelivered(input: {
    attemptCount: number;
    eventId: string;
    providerMessageId: string;
  }): Promise<boolean>;

  markFailed(input: {
    attemptCount: number;
    errorCode: NotificationFailureCategory;
    eventId: string;
    nextAttemptAt: Date | null;
  }): Promise<boolean>;
}

export interface ContactOutboxDispatchSummary {
  ambiguousOutcomes: number;
  claimed: number;
  databaseFailures: number;
  permanentFailures: number;
  retriesScheduled: number;
  sent: number;
  staleClaims: number;
}

export interface ContactOutboxDispatcher {
  dispatchBatch(): Promise<ContactOutboxDispatchSummary>;
}

export function contactOutboxBackoffMs(attemptCount: number): number {
  const exponent = Math.max(0, attemptCount - 1);
  return Math.min(
    60_000 * (2 ** exponent),
    CONTACT_OUTBOX_MAX_BACKOFF_MS,
  );
}

function failureCategory(error: unknown): NotificationFailureCategory {
  return error instanceof ContactNotificationDeliveryError
    ? error.category
    : 'ambiguous-provider-outcome';
}

function isRetryable(category: NotificationFailureCategory): boolean {
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

export function createContactOutboxDispatcher(
  repository: ContactOutboxRepository,
  sender: ContactNotificationSender,
  options: {
    batchSize?: number;
    concurrency?: number;
    leaseMs?: number;
    maxAttempts?: number;
    now?: () => Date;
  } = {},
): ContactOutboxDispatcher {
  const batchSize = options.batchSize ?? CONTACT_OUTBOX_BATCH_SIZE;
  const concurrency = options.concurrency ?? CONTACT_OUTBOX_CONCURRENCY;
  const leaseMs = options.leaseMs ?? CONTACT_OUTBOX_LEASE_MS;
  const maxAttempts = options.maxAttempts ?? CONTACT_OUTBOX_MAX_ATTEMPTS;
  const now = options.now ?? (() => new Date());

  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > 100 ||
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 10 ||
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1 ||
    leaseMs < 60_000
  ) {
    throw new Error('Invalid contact outbox dispatcher configuration');
  }

  return {
    async dispatchBatch() {
      let claimed: ClaimedContactNotification[];
      try {
        claimed = await repository.claimEligible({
          batchSize,
          leaseExpiredBefore: new Date(now().getTime() - leaseMs),
          maxAttempts,
        });
      } catch {
        throw new ContactOutboxDispatchError();
      }
      const summary: ContactOutboxDispatchSummary = {
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
          const delivered = await sender.send(event);
          providerMessageId = delivered.providerMessageId;
        } catch (error) {
          const category = failureCategory(error);
          const retry =
            isRetryable(category) && event.attemptCount < maxAttempts;
          const nextAttemptAt = retry
            ? new Date(now().getTime() + contactOutboxBackoffMs(event.attemptCount))
            : null;

          try {
            const updated = await repository.markFailed({
              attemptCount: event.attemptCount,
              errorCode: category,
              eventId: event.eventId,
              nextAttemptAt,
            });
            if (!updated) {
              summary.staleClaims += 1;
              return;
            }
            if (retry) summary.retriesScheduled += 1;
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
          // The provider accepted the event but persistence did not confirm it.
          // Leave the processing lease intact for safe timeout recovery using
          // the same provider idempotency key.
          summary.ambiguousOutcomes += 1;
          summary.databaseFailures += 1;
        }
      });

      return summary;
    },
  };
}
