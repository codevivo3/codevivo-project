import type { Resend } from 'resend';
import {
  DiscoveryNotificationDeliveryError,
  type DiscoveryNotificationFailureCategory,
  type DiscoveryNotificationSender,
} from './notification-outbox-core';

type ResendSend = Resend['emails']['send'];

export const DISCOVERY_RESEND_IDEMPOTENCY_MAX_LENGTH = 256;
export const DISCOVERY_RESEND_IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1_000;

function classifyResendError(error: {
  name: string;
  statusCode: number | null;
}): DiscoveryNotificationFailureCategory {
  if (error.name === 'concurrent_idempotent_requests') {
    return 'provider-idempotency-in-progress';
  }
  if (error.name === 'invalid_idempotent_request') {
    return 'provider-idempotency-conflict';
  }
  if (
    ['daily_quota_exceeded', 'monthly_quota_exceeded', 'rate_limit_exceeded']
      .includes(error.name)
    || error.statusCode === 429
  ) {
    return 'provider-rate-limit';
  }
  if (error.name === 'application_error' && error.statusCode === null) {
    return 'ambiguous-provider-outcome';
  }
  if (
    ['application_error', 'dns_lookup_failed', 'internal_server_error', 'service_unavailable']
      .includes(error.name)
    || (error.statusCode !== null && error.statusCode >= 500)
  ) {
    return 'temporary-provider-failure';
  }
  if (
    [
      'invalid_api_key',
      'invalid_access',
      'invalid_idempotency_key',
      'invalid_permission',
      'missing_api_key',
      'restricted_api_key',
      'security_error',
      'suspended_api_key',
    ].includes(error.name)
    || error.statusCode === 401
    || error.statusCode === 403
  ) {
    return 'invalid-configuration';
  }
  return 'permanent-provider-failure';
}

function classifyThrownError(error: unknown): DiscoveryNotificationFailureCategory {
  if (!(error instanceof Error)) return 'ambiguous-provider-outcome';
  const code = (error as Error & { code?: unknown }).code;
  if (typeof code === 'string' && ['ENETUNREACH', 'ENOTFOUND'].includes(code)) {
    return 'temporary-provider-failure';
  }
  return 'ambiguous-provider-outcome';
}

function isValidEmail(value: string | undefined): value is string {
  return Boolean(
    value
    && value.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value),
  );
}

export function createResendDiscoveryNotificationSender(
  send: ResendSend | null,
  recipient: string | undefined,
): DiscoveryNotificationSender {
  return {
    async send(event) {
      if (
        !send
        || !isValidEmail(recipient)
        || event.idempotencyKey.length < 1
        || event.idempotencyKey.length > DISCOVERY_RESEND_IDEMPOTENCY_MAX_LENGTH
      ) {
        throw new DiscoveryNotificationDeliveryError('invalid-configuration');
      }

      const text = `A Project Discovery brief has been submitted.

Submission reference: ${event.submissionReference}
Client: ${event.clientName}
Client email: ${event.clientEmail}
Questionnaire locale: ${event.locale}
Submitted at: ${event.submittedAt.toISOString()}

Retrieve the complete brief through the approved Project Discovery administration workflow.`;

      try {
        const result = await send({
          from: 'CodeVivo Project Discovery <contact@codevivo.dev>',
          to: [recipient],
          subject: `Project Discovery submitted — ${event.submissionReference}`,
          text,
          headers: {
            'X-CodeVivo-Source': 'project-discovery',
            'X-Mailer': 'CodeVivo Project Discovery',
          },
        }, { idempotencyKey: event.idempotencyKey });

        if (result.error) {
          throw new DiscoveryNotificationDeliveryError(
            classifyResendError(result.error),
          );
        }
        if (!result.data?.id) {
          throw new DiscoveryNotificationDeliveryError(
            'ambiguous-provider-outcome',
          );
        }
        return { providerMessageId: result.data.id };
      } catch (error) {
        if (error instanceof DiscoveryNotificationDeliveryError) throw error;
        throw new DiscoveryNotificationDeliveryError(classifyThrownError(error));
      }
    },
  };
}
