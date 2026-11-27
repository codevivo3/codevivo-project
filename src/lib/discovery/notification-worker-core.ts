import { createHash, timingSafeEqual } from 'node:crypto';
import {
  DiscoveryOutboxDispatchError,
  type DiscoveryOutboxDispatchSummary,
} from './notification-outbox-core';

const MIN_SECRET_BYTES = 32;
const MAX_SECRET_BYTES = 256;
const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
} as const;

type WorkerLogRecord = {
  event:
    | 'configuration-unavailable'
    | 'disabled'
    | 'dispatch-completed'
    | 'dispatch-failed'
    | 'unauthorized';
  summary?: DiscoveryOutboxDispatchSummary;
};

export type DiscoveryNotificationWorkerDependencies = {
  configurationReady: boolean;
  dispatch(): Promise<DiscoveryOutboxDispatchSummary>;
  enabled?: string;
  log(level: 'error' | 'info' | 'warn', record: WorkerLogRecord): void;
  secret?: string;
};

function isValidSecret(value: string | undefined): value is string {
  if (!value || !/^[\x21-\x7e]+$/u.test(value)) return false;
  const size = Buffer.byteLength(value, 'utf8');
  return size >= MIN_SECRET_BYTES && size <= MAX_SECRET_BYTES;
}

function digest(value: string): Buffer {
  return createHash('sha256')
    .update('codevivo.discovery.outbox-worker.v1\0', 'utf8')
    .update(value, 'utf8')
    .digest();
}

export function isValidDiscoveryWorkerAuthorization(
  authorization: string | null,
  configuredSecret: string | undefined,
): boolean {
  if (!isValidSecret(configuredSecret) || !authorization) return false;
  const match = /^Bearer ([\x21-\x7e]+)$/u.exec(authorization);
  if (!match || !isValidSecret(match[1])) return false;
  return timingSafeEqual(digest(match[1]), digest(configuredSecret));
}

export function isValidDiscoveryWorkerRuntimeConfiguration(input: {
  databaseUrl?: string;
  notificationRecipient?: string;
  resendApiKey?: string;
}): boolean {
  if (
    !input.resendApiKey
    || /\s/u.test(input.resendApiKey)
    || !input.notificationRecipient
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(input.notificationRecipient)
  ) return false;

  try {
    if (!input.databaseUrl) return false;
    const parsed = new URL(input.databaseUrl);
    return ['postgres:', 'postgresql:'].includes(parsed.protocol)
      && decodeURIComponent(parsed.username) === 'codevivo_discovery_runtime'
      && parsed.password.length > 0
      && parsed.hostname.length > 0
      && parsed.pathname.length > 1;
  } catch {
    return false;
  }
}

function response(body: object, status: number): Response {
  return new Response(JSON.stringify(body), { headers: RESPONSE_HEADERS, status });
}

export async function handleDiscoveryNotificationWorkerGet(
  request: Pick<Request, 'headers'>,
  dependencies: DiscoveryNotificationWorkerDependencies,
): Promise<Response> {
  if (dependencies.enabled !== 'true') {
    dependencies.log('info', { event: 'disabled' });
    return response({ status: 'disabled' }, 503);
  }
  if (!isValidSecret(dependencies.secret)) {
    dependencies.log('error', { event: 'configuration-unavailable' });
    return response({ status: 'unavailable' }, 503);
  }
  if (!isValidDiscoveryWorkerAuthorization(
    request.headers.get('authorization'),
    dependencies.secret,
  )) {
    dependencies.log('warn', { event: 'unauthorized' });
    return response({ status: 'unauthorized' }, 401);
  }
  if (!dependencies.configurationReady) {
    dependencies.log('error', { event: 'configuration-unavailable' });
    return response({ status: 'unavailable' }, 503);
  }

  try {
    const summary = await dependencies.dispatch();
    dependencies.log('info', { event: 'dispatch-completed', summary });
    return response({ status: 'completed', summary }, 200);
  } catch (error) {
    dependencies.log('error', { event: 'dispatch-failed' });
    return response(
      { status: 'unavailable' },
      error instanceof DiscoveryOutboxDispatchError ? 503 : 500,
    );
  }
}
