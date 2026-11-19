import assert from 'node:assert/strict';
import test from 'node:test';
import { isAllowedContactOrigin } from '../../src/lib/contact/origin';
import {
  handleContactSubmission,
  resolveContactSubmissionMode,
  type ContactFailureCategory,
  type ContactSubmissionMode,
} from '../../src/lib/contact/submission-core';
import {
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_MESSAGE_MIN_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  validateContactSubmission,
  type ContactSubmission,
} from '../../src/lib/contact/validation';

const validInput = (overrides: Record<string, unknown> = {}) => ({
  email: 'client@example.test',
  idempotencyKey: '10000000-0000-4000-8000-000000000001',
  ipAddress: '203.0.113.10',
  locale: 'en',
  message: 'A sufficiently detailed project message.',
  name: 'Example Client',
  website: '',
  ...overrides,
});

function dependencies(overrides: {
  acceptDurableInquiry?: (submission: ContactSubmission & {
    idempotencyKey: string;
    privacyNoticeVersion: string;
  }) => Promise<unknown>;
  allowedOrigin?: boolean;
  limit?: () => Promise<boolean>;
  logFailure?: (category: ContactFailureCategory) => void;
  mode?: ContactSubmissionMode;
  privacyNoticeVersion?: string;
  sendAcknowledgement?: (submission: ContactSubmission) => Promise<void>;
  sendInternalNotification?: (submission: ContactSubmission) => Promise<void>;
} = {}) {
  return {
    acceptDurableInquiry:
      overrides.acceptDurableInquiry ?? (async () => undefined),
    isAllowedOrigin: () => overrides.allowedOrigin ?? true,
    limit: overrides.limit ?? (async () => true),
    logFailure: overrides.logFailure ?? (() => undefined),
    mode: overrides.mode ?? 'legacy-email',
    privacyNoticeVersion:
      overrides.privacyNoticeVersion ?? 'privacy-2026-01',
    sendAcknowledgement:
      overrides.sendAcknowledgement ?? (async () => undefined),
    sendInternalNotification:
      overrides.sendInternalNotification ?? (async () => undefined),
  };
}

test('shared validation trims valid EN and IT submissions', () => {
  for (const locale of ['en', 'it']) {
    const result = validateContactSubmission({
      email: ' client@example.test ',
      locale,
      message: ' A sufficiently detailed project message. ',
      name: ' Example Client ',
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.name, 'Example Client');
      assert.equal(result.data.email, 'client@example.test');
      assert.equal(result.data.locale, locale);
      assert.equal(result.data.message, 'A sufficiently detailed project message.');
    }
  }
});

test('shared validation enforces requiredness, syntax, lengths, and locale', () => {
  for (const input of [
    validInput({ name: '' }),
    validInput({ name: 'a'.repeat(CONTACT_NAME_MAX_LENGTH + 1) }),
    validInput({ name: 'Header\r\nInjection' }),
    validInput({ email: 'invalid-email' }),
    validInput({ email: `${'a'.repeat(CONTACT_EMAIL_MAX_LENGTH)}@example.test` }),
    validInput({ message: 'a'.repeat(CONTACT_MESSAGE_MIN_LENGTH - 1) }),
    validInput({ message: 'a'.repeat(CONTACT_MESSAGE_MAX_LENGTH + 1) }),
    validInput({ locale: 'fr' }),
  ]) {
    assert.equal(validateContactSubmission(input).success, false);
  }
});

test('origin validation requires matching host and protocol', () => {
  assert.equal(
    isAllowedContactOrigin({
      forwardedHost: 'codevivo.dev',
      forwardedProtocol: 'https',
      origin: 'https://codevivo.dev',
    }),
    true,
  );
  assert.equal(
    isAllowedContactOrigin({
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    }),
    true,
  );
  for (const input of [
    { host: 'codevivo.dev', origin: null },
    { host: 'codevivo.dev', origin: 'https://evil.example' },
    { host: 'codevivo.dev', origin: 'http://codevivo.dev' },
    { host: 'codevivo.dev', origin: 'not-a-url' },
  ]) {
    assert.equal(isAllowedContactOrigin(input), false);
  }
});

test('honeypot remains a silent success without origin, rate, or email work', async () => {
  let sideEffects = 0;
  const result = await handleContactSubmission(
    validInput({ website: 'https://spam.example' }),
    dependencies({
      allowedOrigin: false,
      limit: async () => {
        sideEffects += 1;
        return false;
      },
      sendAcknowledgement: async () => {
        sideEffects += 1;
      },
      sendInternalNotification: async () => {
        sideEffects += 1;
      },
    }),
  );
  assert.deepEqual(result, { success: true, error: null });
  assert.equal(sideEffects, 0);
});

test('active locale is delivered to the acknowledgement operation', async () => {
  let submission: ContactSubmission | undefined;
  const result = await handleContactSubmission(
    validInput({ locale: 'it' }),
    dependencies({
      sendAcknowledgement: async (value) => {
        submission = value;
      },
    }),
  );
  assert.equal(result.success, true);
  assert.equal(submission?.locale, 'it');
});

test('invalid origin, rate limits, and invalid input prevent email delivery', async () => {
  for (const fixture of [
    {
      input: validInput(),
      dependencies: dependencies({ allowedOrigin: false }),
      error: 'origin_rejected',
    },
    {
      input: validInput(),
      dependencies: dependencies({ limit: async () => false }),
      error: 'rate_limited',
    },
    {
      input: validInput({ email: 'invalid' }),
      dependencies: dependencies(),
      error: 'validation_failed',
    },
  ]) {
    let sends = 0;
    const result = await handleContactSubmission(fixture.input, {
      ...fixture.dependencies,
      sendAcknowledgement: async () => {
        sends += 1;
      },
      sendInternalNotification: async () => {
        sends += 1;
      },
    });
    assert.deepEqual(result, { success: false, error: fixture.error });
    assert.equal(sends, 0);
  }
});

test('failures are classified without forwarding provider diagnostics', async () => {
  const categories: ContactFailureCategory[] = [];
  const providerError = new Error(
    'provider payload client@example.test private message',
  );

  const internalFailure = await handleContactSubmission(
    validInput(),
    dependencies({
      logFailure: (category) => categories.push(category),
      sendInternalNotification: async () => {
        throw providerError;
      },
    }),
  );
  assert.deepEqual(internalFailure, {
    success: false,
    error: 'submission_failed',
  });
  assert.deepEqual(categories, ['internal-email']);

  categories.length = 0;
  let internalSends = 0;
  const acknowledgementFailure = await handleContactSubmission(
    validInput(),
    dependencies({
      logFailure: (category) => categories.push(category),
      sendAcknowledgement: async () => {
        throw providerError;
      },
      sendInternalNotification: async () => {
        internalSends += 1;
      },
    }),
  );
  assert.deepEqual(acknowledgementFailure, {
    success: false,
    error: 'submission_failed',
  });
  assert.equal(internalSends, 1);
  assert.deepEqual(categories, ['acknowledgement-email']);
});

test('rate-limit infrastructure failure is fail-closed and safely classified', async () => {
  const categories: ContactFailureCategory[] = [];
  const result = await handleContactSubmission(
    validInput(),
    dependencies({
      limit: async () => {
        throw new Error('secret provider response');
      },
      logFailure: (category) => categories.push(category),
    }),
  );
  assert.deepEqual(result, { success: false, error: 'submission_failed' });
  assert.deepEqual(categories, ['rate-limit-unavailable']);
});

test('submission mode defaults safely to the legacy email path', () => {
  assert.equal(resolveContactSubmissionMode(undefined), 'legacy-email');
  assert.equal(resolveContactSubmissionMode('unexpected'), 'legacy-email');
  assert.equal(
    resolveContactSubmissionMode('durable-outbox'),
    'durable-outbox',
  );
});

test('durable mode accepts one inquiry without synchronous email delivery', async () => {
  const accepted: Array<ContactSubmission & {
    idempotencyKey: string;
    privacyNoticeVersion: string;
  }> = [];
  let emailSends = 0;

  const result = await handleContactSubmission(
    validInput({ locale: 'it' }),
    dependencies({
      acceptDurableInquiry: async (submission) => {
        accepted.push(submission);
      },
      mode: 'durable-outbox',
      sendAcknowledgement: async () => {
        emailSends += 1;
      },
      sendInternalNotification: async () => {
        emailSends += 1;
      },
    }),
  );

  assert.deepEqual(result, {
    success: true,
    error: null,
    rotateIdempotencyKey: true,
  });
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].locale, 'it');
  assert.equal(accepted[0].privacyNoticeVersion, 'privacy-2026-01');
  assert.equal(emailSends, 0);
});

test('legacy mode remains exclusive and never persists an inquiry', async () => {
  let persists = 0;
  let emails = 0;
  const result = await handleContactSubmission(
    validInput(),
    dependencies({
      acceptDurableInquiry: async () => {
        persists += 1;
      },
      sendAcknowledgement: async () => {
        emails += 1;
      },
      sendInternalNotification: async () => {
        emails += 1;
      },
    }),
  );

  assert.equal(result.success, true);
  assert.equal(persists, 0);
  assert.equal(emails, 2);
});

test('durable mode fails closed for missing privacy configuration', async () => {
  const categories: ContactFailureCategory[] = [];
  let sideEffects = 0;
  const result = await handleContactSubmission(
    validInput(),
    dependencies({
      acceptDurableInquiry: async () => {
        sideEffects += 1;
      },
      logFailure: (category) => categories.push(category),
      mode: 'durable-outbox',
      privacyNoticeVersion: ' ',
      sendAcknowledgement: async () => {
        sideEffects += 1;
      },
      sendInternalNotification: async () => {
        sideEffects += 1;
      },
    }),
  );

  assert.deepEqual(result, { success: false, error: 'submission_failed' });
  assert.deepEqual(categories, ['privacy-notice-configuration']);
  assert.equal(sideEffects, 0);
});

test('durable persistence failures are sanitized and never fall back to email', async () => {
  for (const error of [
    Object.assign(new Error('private database diagnostic'), {
      code: 'database-unavailable',
    }),
    new Error('ambiguous transaction outcome with private details'),
  ]) {
    const categories: ContactFailureCategory[] = [];
    let emailSends = 0;
    const result = await handleContactSubmission(
      validInput(),
      dependencies({
        acceptDurableInquiry: async () => {
          throw error;
        },
        logFailure: (category) => categories.push(category),
        mode: 'durable-outbox',
        sendAcknowledgement: async () => {
          emailSends += 1;
        },
        sendInternalNotification: async () => {
          emailSends += 1;
        },
      }),
    );

    assert.deepEqual(result, { success: false, error: 'submission_failed' });
    assert.deepEqual(categories, ['durable-persistence']);
    assert.equal(emailSends, 0);
  }
});

test('confirmed durable payload conflicts request idempotency-key rotation', async () => {
  const result = await handleContactSubmission(
    validInput(),
    dependencies({
      acceptDurableInquiry: async () => {
        throw Object.assign(new Error('sanitized conflict'), {
          code: 'idempotency-conflict',
        });
      },
      mode: 'durable-outbox',
    }),
  );

  assert.deepEqual(result, {
    success: false,
    error: 'submission_failed',
    rotateIdempotencyKey: true,
  });
});

test('durable acceptance does not depend on worker availability', async () => {
  let accepted = 0;
  const result = await handleContactSubmission(
    validInput(),
    dependencies({
      acceptDurableInquiry: async () => {
        accepted += 1;
        return { queuedNotifications: 2 };
      },
      mode: 'durable-outbox',
    }),
  );

  assert.equal(result.success, true);
  assert.equal(accepted, 1);
});
