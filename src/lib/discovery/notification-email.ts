import 'server-only';

import { Resend } from 'resend';
import { createResendDiscoveryNotificationSender } from './notification-email-core';

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

export const discoveryNotificationSender =
  createResendDiscoveryNotificationSender(
    resend ? resend.emails.send.bind(resend.emails) : null,
    process.env.DISCOVERY_NOTIFICATION_TO,
  );
