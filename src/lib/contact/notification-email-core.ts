import type { Resend } from 'resend';
import ContactEmail from '@/emails/ContactEmail';
import {
  ContactNotificationDeliveryError,
  type ClaimedContactNotification,
  type ContactNotificationSender,
  type NotificationFailureCategory,
} from './outbox-core';

type ResendSend = Resend['emails']['send'];

export const RESEND_IDEMPOTENCY_MAX_LENGTH = 256;
/**
 * Resend retains idempotency records for 24 hours. A recovery attempt after
 * this window is at-least-once and may produce a duplicate delivery.
 */
export const RESEND_IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1_000;

function classifyResendError(error: {
  name: string;
  statusCode: number | null;
}): NotificationFailureCategory {
  if (error.name === 'concurrent_idempotent_requests') {
    return 'provider-idempotency-in-progress';
  }
  if (error.name === 'invalid_idempotent_request') {
    return 'provider-idempotency-conflict';
  }
  if (
    [
      'daily_quota_exceeded',
      'monthly_quota_exceeded',
      'rate_limit_exceeded',
    ].includes(error.name) ||
    error.statusCode === 429
  ) {
    return 'provider-rate-limit';
  }
  if (error.name === 'application_error' && error.statusCode === null) {
    return 'ambiguous-provider-outcome';
  }
  if (
    [
      'application_error',
      'dns_lookup_failed',
      'internal_server_error',
      'service_unavailable',
    ].includes(error.name) ||
    (error.statusCode !== null && error.statusCode >= 500)
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

function classifyThrownProviderError(error: unknown): NotificationFailureCategory {
  if (!(error instanceof Error)) return 'ambiguous-provider-outcome';
  const coded = error as Error & { code?: unknown };
  const code = typeof coded.code === 'string' ? coded.code : '';
  if (['ENETUNREACH', 'ENOTFOUND'].includes(code)) {
    return 'temporary-provider-failure';
  }
  return 'ambiguous-provider-outcome';
}

function acknowledgementText(event: ClaimedContactNotification): string {
  return event.locale === 'it'
    ? `Ciao ${event.name},

Grazie per avermi scritto tramite il mio sito — ho ricevuto il tuo messaggio.

Lo leggerò con attenzione e ti risponderò il prima possibile.

Nel frattempo, se vuoi dare un'occhiata ai miei progetti:
https://codevivo.dev

A presto,
Francesco

—
Francesco De Vivo
Frontend Developer
https://codevivo.dev`
    : `Hi ${event.name},

Thanks for getting in touch through my website — I’ve received your message.

I’ll take a look and get back to you as soon as possible.

In the meantime, feel free to explore some of my work here:
https://codevivo.dev

Talk soon,
Francesco

—
Francesco De Vivo
Frontend Developer
https://codevivo.dev`;
}

export function createResendContactNotificationSender(
  send: ResendSend | null,
): ContactNotificationSender {
  return {
    async send(event) {
      if (!send) {
        throw new ContactNotificationDeliveryError('invalid-configuration');
      }
      if (
        event.idempotencyKey.length < 1 ||
        event.idempotencyKey.length > RESEND_IDEMPOTENCY_MAX_LENGTH
      ) {
        throw new ContactNotificationDeliveryError('invalid-configuration');
      }

      const payload = event.eventType === 'internal_alert'
        ? {
            from: 'CodeVivo Contact <contact@codevivo.dev>',
            to: ['hello@codevivo.dev'],
            replyTo: `${event.name} <${event.email}>`,
            subject: `CodeVivo contact form — message from ${event.name}`,
            react: ContactEmail({
              name: event.name,
              email: event.email,
              message: event.message,
            }),
            text: `New message from CodeVivo contact form

Name: ${event.name}
Email: ${event.email}

Message:
${event.message}`,
            headers: {
              'X-Mailer': 'CodeVivo Contact Form',
              'X-CodeVivo-Source': 'portfolio-contact',
            },
          }
        : {
            from: 'CodeVivo <contact@codevivo.dev>',
            to: [event.email],
            subject: event.locale === 'it'
              ? 'Grazie per avermi contattato — CodeVivo'
              : 'Thanks for reaching out — CodeVivo',
            text: acknowledgementText(event),
            headers: {
              'X-Mailer': 'CodeVivo Contact Form',
              'X-CodeVivo-Source': 'portfolio-autoreply',
            },
          };

      try {
        const result = await send(payload, {
          idempotencyKey: event.idempotencyKey,
        });
        if (result.error) {
          throw new ContactNotificationDeliveryError(
            classifyResendError(result.error),
          );
        }
        if (!result.data?.id) {
          throw new ContactNotificationDeliveryError(
            'ambiguous-provider-outcome',
          );
        }
        return { providerMessageId: result.data.id };
      } catch (error) {
        if (error instanceof ContactNotificationDeliveryError) throw error;
        throw new ContactNotificationDeliveryError(
          classifyThrownProviderError(error),
        );
      }
    },
  };
}
