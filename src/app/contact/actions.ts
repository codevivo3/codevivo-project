'use server';

/**
<<<<<<< Updated upstream
 * Contact Actions
=======
 * sendContactEmail
>>>>>>> Stashed changes
 *
 * Purpose:
 * Handles contact form submissions, rate limiting, and outbound email delivery.
 *
 * Context:
<<<<<<< Updated upstream
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
=======
 * Called by the contact form server action flow when visitors submit the site contact form.
 *
 * Notes:
 * This file runs only on the server and depends on Resend plus the shared Upstash limiter.
>>>>>>> Stashed changes
 */

import { Resend } from 'resend';
import { headers } from 'next/headers';
import { ratelimit } from '@/lib/rate-limit';
import ContactEmail from '@/emails/ContactEmail';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendContactEmail(
  _previousState: { success: boolean; error: string | null },
  formData: FormData,
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Derived values
    const website = formData.get('website')?.toString();
    const name = formData.get('name')?.toString().trim();
    const email = formData.get('email')?.toString().trim();
    const message = formData.get('message')?.toString().trim();

    // Honeypot field: treat bot submissions as successful no-ops to avoid feedback loops.
    if (website) {
      return {
        success: true,
        error: null,
      };
    }

    // Infer the reply language from the request headers used by the public form.
    const h = await headers();
    const acceptLanguage = h.get('accept-language') || '';
    const isItalian = acceptLanguage.toLowerCase().startsWith('it');

    // Rate limit by the best available client IP signal before performing email work.
    const ip =
      h.get('x-forwarded-for')?.split(',')[0] ??
      h.get('x-real-ip') ??
      'anonymous';

    const { success } = await ratelimit.limit(ip);

    if (!success) {
      return {
        success: false,
        error: 'Too many requests. Please try again later.',
      };
    }

    if (!name || !email || !message) {
      return {
        success: false,
        error: 'Missing required fields',
      };
    }

    if (name.length > 100 || email.length > 200 || message.length > 5000) {
      return {
        success: false,
        error: 'Invalid input length',
      };
    }

    await resend.emails.send({
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

<<<<<<< Updated upstream
    // Auto-reply in the visitor language after the internal notification succeeds.
=======
    // Send a localized confirmation so the visitor gets immediate feedback after submission.
>>>>>>> Stashed changes
    await resend.emails.send({
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

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error('Contact form error:', error);

    return {
      success: false,
      error: 'Failed to send message',
    };
  }
}
