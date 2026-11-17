import { createHash, timingSafeEqual } from 'node:crypto';
import {
  ContactOutboxDispatchError,
  type ContactOutboxDispatchSummary,
} from './outbox-core';

const WORKER_SECRET_MIN_BYTES = 32;
const WORKER_SECRET_MAX_BYTES = 256;

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
} as const;

type WorkerLogLevel = 'error' | 'info' | 'warn';

type WorkerLogRecord = {
  event:
    | 'configuration-unavailable'
    | 'disabled'
    | 'dispatch-completed'
    | 'dispatch-failed'
    | 'unauthorized';
  summary?: ContactOutboxDispatchSummary;
};

export type ContactNotificationWorkerDependencies = {
  configurationReady: boolean;
  dispatch(): Promise<ContactOutboxDispatchSummary>;
  enabled?: string;
  log(level: WorkerLogLevel, record: WorkerLogRecord): void;
  secret?: string;
};

export function isValidContactWorkerRuntimeConfiguration(
  databaseUrl: string | undefined,
  resendApiKey: string | undefined,
): boolean {
  if (!databaseUrl || !resendApiKey || /\s/u.test(resendApiKey)) return false;

  try {
    const parsed = new URL(databaseUrl);
    return ['postgres:', 'postgresql:'].includes(parsed.protocol)
      && decodeURIComponent(parsed.username) === 'codevivo_contact_runtime'
      && parsed.password.length > 0
      && parsed.hostname.length > 0
      && parsed.pathname.length > 1;
  } catch {
    return false;
  }
}

function jsonResponse(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: RESPONSE_HEADERS,
    status,
  });
}

function isValidSecret(secret: string | undefined): secret is string {
  if (!secret || !/^[\x21-\x7e]+$/u.test(secret)) return false;
  const byteLength = Buffer.byteLength(secret, 'utf8');
  return byteLength >= WORKER_SECRET_MIN_BYTES
    && byteLength <= WORKER_SECRET_MAX_BYTES;
}

function hashSecret(secret: string): Buffer {
  return createHash('sha256')
    .update('codevivo.contact.outbox-worker.v1\0', 'utf8')
    .update(secret, 'utf8')
    .digest();
}

export function isValidWorkerAuthorization(
  authorization: string | null,
  configuredSecret: string | undefined,
): boolean {
  if (!isValidSecret(configuredSecret) || !authorization) return false;

  const match = /^Bearer ([\x21-\x7e]+)$/u.exec(authorization);
  if (!match || !isValidSecret(match[1])) return false;

  return timingSafeEqual(
    hashSecret(match[1]),
    hashSecret(configuredSecret),
  );
}

export async function handleContactNotificationWorkerGet(
  request: Pick<Request, 'headers'>,
  dependencies: ContactNotificationWorkerDependencies,
): Promise<Response> {
  if (dependencies.enabled !== 'true') {
    dependencies.log('info', { event: 'disabled' });
    return jsonResponse({ status: 'disabled' }, 503);
  }

  if (!isValidSecret(dependencies.secret)) {
    dependencies.log('error', { event: 'configuration-unavailable' });
    return jsonResponse({ status: 'unavailable' }, 503);
  }

  if (!isValidWorkerAuthorization(
    request.headers.get('authorization'),
    dependencies.secret,
  )) {
    dependencies.log('warn', { event: 'unauthorized' });
    return jsonResponse({ status: 'unauthorized' }, 401);
  }

  if (!dependencies.configurationReady) {
    dependencies.log('error', { event: 'configuration-unavailable' });
    return jsonResponse({ status: 'unavailable' }, 503);
  }

  try {
    const summary = await dependencies.dispatch();
    dependencies.log('info', {
      event: 'dispatch-completed',
      summary,
    });
    return jsonResponse({ status: 'completed', summary }, 200);
  } catch (error) {
    dependencies.log('error', { event: 'dispatch-failed' });
    const status = error instanceof ContactOutboxDispatchError ? 503 : 500;
    return jsonResponse({ status: 'unavailable' }, status);
  }
}
