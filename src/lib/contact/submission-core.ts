import {
  validateContactSubmission,
  type ContactSubmission,
} from './validation';

export interface ContactFormState {
  error: string | null;
  success: boolean;
}

export type ContactFailureCategory =
  | 'acknowledgement-email'
  | 'internal-email'
  | 'rate-limit-unavailable';

interface ContactSubmissionDependencies {
  isAllowedOrigin(): boolean;
  limit(ipAddress: string): Promise<boolean>;
  logFailure(category: ContactFailureCategory): void;
  sendAcknowledgement(submission: ContactSubmission): Promise<void>;
  sendInternalNotification(submission: ContactSubmission): Promise<void>;
}

const genericFailure = (error: string): ContactFormState => ({
  success: false,
  error,
});

export async function handleContactSubmission(
  input: {
    email: unknown;
    ipAddress: string;
    locale: unknown;
    message: unknown;
    name: unknown;
    website: unknown;
  },
  dependencies: ContactSubmissionDependencies,
): Promise<ContactFormState> {
  if (typeof input.website === 'string' && input.website.length > 0) {
    return { success: true, error: null };
  }

  if (!dependencies.isAllowedOrigin()) {
    return genericFailure('origin_rejected');
  }

  let allowed: boolean;
  try {
    allowed = await dependencies.limit(input.ipAddress);
  } catch {
    dependencies.logFailure('rate-limit-unavailable');
    return genericFailure('submission_failed');
  }
  if (!allowed) return genericFailure('rate_limited');

  const validation = validateContactSubmission(input);
  if (!validation.success) return genericFailure('validation_failed');

  try {
    await dependencies.sendInternalNotification(validation.data);
  } catch {
    dependencies.logFailure('internal-email');
    return genericFailure('submission_failed');
  }

  try {
    await dependencies.sendAcknowledgement(validation.data);
  } catch {
    dependencies.logFailure('acknowledgement-email');
    return genericFailure('submission_failed');
  }

  return { success: true, error: null };
}
