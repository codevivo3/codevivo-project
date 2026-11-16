'use server';

/**
 * Contact Actions
 *
 * Purpose:
 * Handles contact form submissions, rate limiting, and outbound email delivery.
 *
 * Context:
 * Called by `ContactForm` as a Next.js Server Action.
 *
 * Dependencies:
 * - Resend for outbound email delivery
 * - Upstash rate limiting from `src/lib/rate-limit.ts`
 * - `ContactEmail` for the internal inbox template
 *
 * Notes:
 * - This file must remain server-only because it reads headers and secrets.
 * - Validation, anti-spam checks, and email side effects are intentionally centralized here.
 */

import { Resend } from 'resend';
import { headers } from 'next/headers';
import { ratelimit } from '@/lib/rate-limit';
import ContactEmail from '@/emails/ContactEmail';
import { isAllowedContactOrigin } from '@/lib/contact/origin';
import {
  handleContactSubmission,
  type ContactFailureCategory,
  type ContactFormState,
} from '@/lib/contact/submission-core';
import type { ContactSubmission } from '@/lib/contact/validation';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendContactEmail(
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const h = await headers();
  const ipAddress =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'anonymous';

  const sendInternalNotification = async (submission: ContactSubmission) => {
    const { name, email, message } = submission;
    const result = await resend.emails.send({
      from: 'CodeVivo Contact <contact@codevivo.dev>',
      to: ['hello@codevivo.dev'],
      replyTo: `${name} <${email}>`,
      subject: `CodeVivo contact form — message from ${name}`,
      react: ContactEmail({
        name,
        email,
        message,
      }),
      text: `New message from CodeVivo contact form

Name: ${name}
Email: ${email}

Message:
${message}`,
      headers: {
        'X-Mailer': 'CodeVivo Contact Form',
        'X-CodeVivo-Source': 'portfolio-contact',
      },
    });
    if (result.error) throw new Error('Internal notification rejected');
  };

  const sendAcknowledgement = async (submission: ContactSubmission) => {
    const { name, email, locale } = submission;
    const isItalian = locale === 'it';
    const result = await resend.emails.send({
      from: 'CodeVivo <contact@codevivo.dev>',
      to: [email],
      subject: isItalian
        ? 'Grazie per avermi contattato — CodeVivo'
        : 'Thanks for reaching out — CodeVivo',
      text: isItalian
        ? `Ciao ${name},

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
        : `Hi ${name},

Thanks for getting in touch through my website — I’ve received your message.

I’ll take a look and get back to you as soon as possible.

In the meantime, feel free to explore some of my work here:
https://codevivo.dev

Talk soon,
Francesco

—
Francesco De Vivo
Frontend Developer
https://codevivo.dev`,
      headers: {
        'X-Mailer': 'CodeVivo Contact Form',
        'X-CodeVivo-Source': 'portfolio-autoreply',
      },
    });
    if (result.error) throw new Error('Acknowledgement rejected');
  };

  const logFailure = (category: ContactFailureCategory) => {
    console.error('Contact form submission failed', { category });
  };

  return handleContactSubmission(
    {
      email: formData.get('email'),
      ipAddress,
      locale: formData.get('locale'),
      message: formData.get('message'),
      name: formData.get('name'),
      website: formData.get('website'),
    },
    {
      isAllowedOrigin: () =>
        isAllowedContactOrigin({
          forwardedHost: h.get('x-forwarded-host'),
          forwardedProtocol: h.get('x-forwarded-proto'),
          host: h.get('host'),
          origin: h.get('origin'),
        }),
      limit: async (identifier) =>
        (await ratelimit.limit(identifier)).success,
      logFailure,
      sendAcknowledgement,
      sendInternalNotification,
    },
  );
}
