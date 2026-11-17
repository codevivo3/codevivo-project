export const CONTACT_NAME_MAX_LENGTH = 100;
export const CONTACT_EMAIL_MAX_LENGTH = 200;
export const CONTACT_MESSAGE_MIN_LENGTH = 20;
export const CONTACT_MESSAGE_MAX_LENGTH = 5_000;
export const CONTACT_EMAIL_PATTERN_SOURCE = '[^\\s@]+@[^\\s@]+\\.[^\\s@]+';

export const CONTACT_LOCALES = ['en', 'it'] as const;
export type ContactLocale = (typeof CONTACT_LOCALES)[number];

export interface ContactSubmission {
  email: string;
  locale: ContactLocale;
  message: string;
  name: string;
}

export type ContactValidationResult =
  | { success: true; data: ContactSubmission }
  | { success: false };

const emailPattern = new RegExp(`^${CONTACT_EMAIL_PATTERN_SOURCE}$`, 'u');

function normalizedString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

export function isContactLocale(value: unknown): value is ContactLocale {
  return CONTACT_LOCALES.includes(value as ContactLocale);
}

export function normalizeContactEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateContactSubmission(input: {
  email: unknown;
  locale: unknown;
  message: unknown;
  name: unknown;
}): ContactValidationResult {
  const name = normalizedString(input.name);
  const email = normalizedString(input.email);
  const message = normalizedString(input.message);
  const locale = normalizedString(input.locale);

  if (
    !name ||
    name.length > CONTACT_NAME_MAX_LENGTH ||
    /[\r\n]/u.test(name) ||
    !email ||
    email.length > CONTACT_EMAIL_MAX_LENGTH ||
    !emailPattern.test(email) ||
    !message ||
    message.length < CONTACT_MESSAGE_MIN_LENGTH ||
    message.length > CONTACT_MESSAGE_MAX_LENGTH ||
    !isContactLocale(locale)
  ) {
    return { success: false };
  }

  return {
    success: true,
    data: { email, locale, message, name },
  };
}
