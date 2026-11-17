import 'server-only';

import { Resend } from 'resend';
import { createResendContactNotificationSender } from './notification-email-core';

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

export const contactNotificationSender =
  createResendContactNotificationSender(
    resend ? resend.emails.send.bind(resend.emails) : null,
  );
