'use server';

/**
 * File: src/app/contact/actions.ts
 * Purpose: Server Action used by the ContactForm component to send emails
 * from the CodeVivo contact form to hello@codevivo.dev using Resend.
 *
 * This runs only on the server (Next.js Server Action).
 * The RESEND_API_KEY must exist in `.env.local` and Vercel environment variables.
 */

import { Resend } from 'resend';
import { headers } from 'next/headers';
import { ratelimit } from '@/lib/rate-limit';
import ContactEmail from '@/emails/ContactEmail';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * sendContactEmail
 * Receives validated form data and sends it to the CodeVivo inbox.
 */
export async function sendContactEmail(
  _previousState: { success: boolean; error: string | null },
  formData: FormData,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const website = formData.get('website')?.toString();
    const name = formData.get('name')?.toString().trim();
    const email = formData.get('email')?.toString().trim();
    const message = formData.get('message')?.toString().trim();

    if (website) {
      return {
        success: true,
        error: null,
      };
    }

    const h = await headers();
    const acceptLanguage = h.get('accept-language') || '';
    const isItalian = acceptLanguage.toLowerCase().startsWith('it');

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

    // Auto‑reply to the visitor confirming message receipt
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
