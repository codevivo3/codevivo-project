import { discoveryNotificationDispatcher } from '@/lib/discovery/notification-dispatcher';
import {
  handleDiscoveryNotificationWorkerGet,
  isValidDiscoveryWorkerRuntimeConfiguration,
} from '@/lib/discovery/notification-worker-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 25;

export async function GET(request: Request) {
  return handleDiscoveryNotificationWorkerGet(request, {
    configurationReady: isValidDiscoveryWorkerRuntimeConfiguration({
      databaseUrl: process.env.DATABASE_URL,
      notificationRecipient: process.env.DISCOVERY_NOTIFICATION_TO,
      resendApiKey: process.env.RESEND_API_KEY,
    }),
    dispatch: () => discoveryNotificationDispatcher.dispatchBatch(),
    enabled: process.env.DISCOVERY_OUTBOX_WORKER_ENABLED,
    log(level, record) {
      console[level]('Discovery notification worker', record);
    },
    secret: process.env.DISCOVERY_OUTBOX_WORKER_SECRET,
  });
}
