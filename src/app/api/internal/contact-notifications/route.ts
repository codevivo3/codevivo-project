import { contactNotificationDispatcher } from '@/lib/contact/notification-dispatcher';
import {
  handleContactNotificationWorkerGet,
  isValidContactWorkerRuntimeConfiguration,
} from '@/lib/contact/notification-worker-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 25;

export async function GET(request: Request) {
  return handleContactNotificationWorkerGet(request, {
    configurationReady: isValidContactWorkerRuntimeConfiguration(
      process.env.CONTACT_DATABASE_URL,
      process.env.RESEND_API_KEY,
    ),
    dispatch: () => contactNotificationDispatcher.dispatchBatch(),
    enabled: process.env.CONTACT_OUTBOX_WORKER_ENABLED,
    log(level, record) {
      console[level]('Contact notification worker', record);
    },
    secret: process.env.CONTACT_OUTBOX_WORKER_SECRET,
  });
}
