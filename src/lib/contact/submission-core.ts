import {
  validateContactSubmission,
  type ContactSubmission,
} from './validation';
import { isContactIdempotencyKey } from './idempotency';

export interface ContactFormState {
  error: string | null;
  rotateIdempotencyKey?: boolean;
  success: boolean;
}

export type ContactSubmissionMode = 'durable-outbox' | 'legacy-email';

export type ContactFailureCategory =
  | 'acknowledgement-email'
  | 'durable-persistence'
  | 'internal-email'
  | 'privacy-notice-configuration'
  | 'rate-limit-unavailable';

interface ContactSubmissionDependencies {
  acceptDurableInquiry(input: ContactSubmission & {
    idempotencyKey: string;
    privacyNoticeVersion: string;
  }): Promise<unknown>;
  isAllowedOrigin(): boolean;
  limit(ipAddress: string): Promise<boolean>;
  logFailure(category: ContactFailureCategory): void;
  mode: ContactSubmissionMode;
  privacyNoticeVersion?: string;
  sendAcknowledgement(submission: ContactSubmission): Promise<void>;
  sendInternalNotification(submission: ContactSubmission): Promise<void>;
}

const genericFailure = (error: string): ContactFormState => ({
  success: false,
  error,
});

export function resolveContactSubmissionMode(
  value: string | undefined,
): ContactSubmissionMode {
  return value === 'durable-outbox' ? 'durable-outbox' : 'legacy-email';
}

function repositoryErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

export async function handleContactSubmission(
  input: {
    email: unknown;
    idempotencyKey: unknown;
    ipAddress: string;
    locale: unknown;
    message: unknown;
    name: unknown;
    website: unknown;
  },
  dependencies: ContactSubmissionDependencies,
): Promise<ContactFormState> {
  if (typeof input.website === 'string' && input.website.length > 0) {
    return { success: true, error: null };
  }

  if (!dependencies.isAllowedOrigin()) {
    return genericFailure('origin_rejected');
  }

  let allowed: boolean;
  try {
    allowed = await dependencies.limit(input.ipAddress);
  } catch {
    dependencies.logFailure('rate-limit-unavailable');
    return genericFailure('submission_failed');
  }
  if (!allowed) return genericFailure('rate_limited');

  const validation = validateContactSubmission(input);
  if (!validation.success) return genericFailure('validation_failed');

  if (dependencies.mode === 'durable-outbox') {
    const idempotencyKey = typeof input.idempotencyKey === 'string'
      ? input.idempotencyKey.trim().toLowerCase()
      : '';
    const privacyNoticeVersion = dependencies.privacyNoticeVersion?.trim() ?? '';

    if (!isContactIdempotencyKey(idempotencyKey)) {
      return genericFailure('validation_failed');
    }
    if (
      privacyNoticeVersion.length < 1 ||
      privacyNoticeVersion.length > 100
    ) {
      dependencies.logFailure('privacy-notice-configuration');
      return genericFailure('submission_failed');
    }

    try {
      await dependencies.acceptDurableInquiry({
        ...validation.data,
        idempotencyKey,
        privacyNoticeVersion,
      });
    } catch (error) {
      const code = repositoryErrorCode(error);
      if (code === 'idempotency-conflict') {
        return {
          ...genericFailure('submission_failed'),
          rotateIdempotencyKey: true,
        };
      }
      dependencies.logFailure(
        code === 'privacy-notice-unavailable'
          ? 'privacy-notice-configuration'
          : 'durable-persistence',
      );
      return genericFailure('submission_failed');
    }

    return { success: true, error: null, rotateIdempotencyKey: true };
  }

  try {
    await dependencies.sendInternalNotification(validation.data);
  } catch {
    dependencies.logFailure('internal-email');
    return genericFailure('submission_failed');
  }

  try {
    await dependencies.sendAcknowledgement(validation.data);
  } catch {
    dependencies.logFailure('acknowledgement-email');
    return genericFailure('submission_failed');
  }

  return { success: true, error: null, rotateIdempotencyKey: true };
}
