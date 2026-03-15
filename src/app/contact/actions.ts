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
      from: 'CodeVivo Contact <hello@codevivo.dev>',
      to: ['hello@codevivo.dev'],
      replyTo: email,
      subject: 'New message from CodeVivo contact form',
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
