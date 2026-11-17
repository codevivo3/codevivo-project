import assert from 'node:assert/strict';
import test from 'node:test';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import {
  CONTACT_RETENTION_POLICY_VERSION,
  ContactRepositoryError,
  createContactInquiryRepository,
  createNeonContactPersistence,
  type ContactPersistenceOperation,
} from '../../src/lib/contact/repository-core';

const approvedNotice = 'privacy-2026-01';
const baseInput = (overrides: Record<string, unknown> = {}) => ({
  email: ' Client@Example.test ',
  idempotencyKey: '10000000-0000-4000-8000-000000000001',
  locale: 'en' as const,
  message: 'A sufficiently detailed project inquiry message.',
  name: ' Example Client ',
  privacyNoticeVersion: approvedNotice,
  ...overrides,
});

type Prepared = Parameters<ContactPersistenceOperation>[0];

class MemoryPersistence {
  contacts = new Map<string, { id: string; interactions: number }>();
  inquiries = new Map<
    string,
    {
      contactId: string;
      createdAt: Date;
      id: string;
      payloadHash: string;
    }
  >();
  events = new Map<string, Set<string>>();
  failNext = false;
  private lock = Promise.resolve();

  persist: ContactPersistenceOperation = async (input) => {
    const previous = this.lock;
    let release: () => void = () => {};
    this.lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    try {
      const existing = this.inquiries.get(input.idempotencyKey);
      if (existing) {
        return {
          contact_id: existing.contactId,
          created_at: existing.createdAt,
          inquiry_id: existing.id,
          outcome:
            existing.payloadHash === input.payloadHash
              ? 'replayed'
              : 'conflict',
        };
      }

      if (
        input.privacyNoticeVersion !== approvedNotice ||
        input.locale !== 'en'
      ) {
        return {
          contact_id: null,
          created_at: null,
          inquiry_id: null,
          outcome: 'privacy_unavailable',
        };
      }

      const contacts = new Map(this.contacts);
      const inquiries = new Map(this.inquiries);
      const events = new Map(this.events);
      const contact = contacts.get(input.normalizedEmail) ?? {
        id: input.contactId,
        interactions: 0,
      };
      contacts.set(input.normalizedEmail, {
        ...contact,
        interactions: contact.interactions + 1,
      });

      const createdAt = new Date('2026-11-17T12:00:00.000Z');
      inquiries.set(input.idempotencyKey, {
        contactId: contact.id,
        createdAt,
        id: input.inquiryId,
        payloadHash: input.payloadHash,
      });
      events.set(input.inquiryId, new Set([
        'internal_alert',
        'visitor_acknowledgement',
      ]));

      if (this.failNext) {
        this.failNext = false;
        throw Object.assign(new Error('private submitted message'), {
          code: '23514',
        });
      }

      this.contacts = contacts;
      this.inquiries = inquiries;
      this.events = events;
      return {
        contact_id: contact.id,
        created_at: createdAt,
        inquiry_id: input.inquiryId,
        outcome: 'created',
      };
    } finally {
      release();
    }
  };
}

function assertRepositoryError(
  error: unknown,
  code: ContactRepositoryError['code'],
): boolean {
  assert.ok(error instanceof ContactRepositoryError);
  assert.equal(error.code, code);
  assert.doesNotMatch(error.message, /client|private|postgres|connection/iu);
  return true;
}

test('normalizes email and creates one atomic inquiry with two outbox events', async () => {
  const memory = new MemoryPersistence();
  let prepared: Prepared | undefined;
  const repository = createContactInquiryRepository(async (input) => {
    prepared = input;
    return memory.persist(input);
  });

  const result = await repository.acceptInquiry(baseInput());

  assert.equal(prepared?.normalizedEmail, 'client@example.test');
  assert.equal(prepared?.name, 'Example Client');
  assert.equal(prepared?.email, 'Client@Example.test');
  assert.match(prepared?.payloadHash ?? '', /^[0-9a-f]{64}$/u);
  assert.equal(result.replayed, false);
  assert.equal(memory.contacts.size, 1);
  assert.equal(memory.inquiries.size, 1);
  assert.deepEqual(
    [...(memory.events.get(result.inquiryId) ?? [])].sort(),
    ['internal_alert', 'visitor_acknowledgement'],
  );
});

test('identical replay returns the original inquiry without duplicate events', async () => {
  const memory = new MemoryPersistence();
  const repository = createContactInquiryRepository(memory.persist);

  const first = await repository.acceptInquiry(baseInput());
  const replay = await repository.acceptInquiry(baseInput());

  assert.equal(replay.replayed, true);
  assert.equal(replay.inquiryId, first.inquiryId);
  assert.equal(replay.contactId, first.contactId);
  assert.equal(memory.inquiries.size, 1);
  assert.equal(memory.events.get(first.inquiryId)?.size, 2);
});

test('same idempotency key with a different payload is a sanitized conflict', async () => {
  const memory = new MemoryPersistence();
  const repository = createContactInquiryRepository(memory.persist);
  await repository.acceptInquiry(baseInput());

  await assert.rejects(
    repository.acceptInquiry(baseInput({
      message: 'A different sufficiently detailed project inquiry.',
    })),
    (error) => assertRepositoryError(error, 'idempotency-conflict'),
  );
  assert.equal(memory.inquiries.size, 1);
});

test('concurrent identical submissions create one inquiry and one event pair', async () => {
  const memory = new MemoryPersistence();
  const repository = createContactInquiryRepository(memory.persist);

  const results = await Promise.all([
    repository.acceptInquiry(baseInput()),
    repository.acceptInquiry(baseInput()),
  ]);

  assert.equal(results.filter((result) => result.replayed).length, 1);
  assert.equal(new Set(results.map((result) => result.inquiryId)).size, 1);
  assert.equal(memory.inquiries.size, 1);
  assert.equal(memory.events.size, 1);
});

test('concurrent distinct inquiries for one email share one contact', async () => {
  const memory = new MemoryPersistence();
  const repository = createContactInquiryRepository(memory.persist);

  const results = await Promise.all([
    repository.acceptInquiry(baseInput()),
    repository.acceptInquiry(baseInput({
      idempotencyKey: '20000000-0000-4000-8000-000000000002',
      message: 'A second sufficiently detailed project inquiry.',
    })),
  ]);

  assert.equal(new Set(results.map((result) => result.contactId)).size, 1);
  assert.equal(new Set(results.map((result) => result.inquiryId)).size, 2);
  assert.equal(memory.contacts.size, 1);
  assert.equal(memory.inquiries.size, 2);
  assert.equal(memory.events.size, 2);
});

test('a failed atomic operation leaves no partial contact, inquiry, or event', async () => {
  const memory = new MemoryPersistence();
  memory.failNext = true;
  const repository = createContactInquiryRepository(memory.persist);

  await assert.rejects(
    repository.acceptInquiry(baseInput()),
    (error) => assertRepositoryError(error, 'internal-failure'),
  );
  assert.equal(memory.contacts.size, 0);
  assert.equal(memory.inquiries.size, 0);
  assert.equal(memory.events.size, 0);
});

test('requires valid submission and approved privacy metadata before persistence', async () => {
  let calls = 0;
  const repository = createContactInquiryRepository(async () => {
    calls += 1;
    throw new Error('must not execute');
  });

  await assert.rejects(
    repository.acceptInquiry(baseInput({ message: 'too short' })),
    (error) => assertRepositoryError(error, 'validation-failed'),
  );
  await assert.rejects(
    repository.acceptInquiry(baseInput({ privacyNoticeVersion: ' ' })),
    (error) => assertRepositoryError(error, 'privacy-notice-unavailable'),
  );
  assert.equal(calls, 0);

  const unavailable = createContactInquiryRepository(
    new MemoryPersistence().persist,
  );
  await assert.rejects(
    unavailable.acceptInquiry(baseInput({ privacyNoticeVersion: 'unapproved' })),
    (error) => assertRepositoryError(error, 'privacy-notice-unavailable'),
  );
});

test('classifies unavailable and internal database failures without leakage', async () => {
  const unavailable = createContactInquiryRepository(async () => {
    throw Object.assign(new Error('secret connection string'), {
      code: 'ETIMEDOUT',
    });
  });
  await assert.rejects(
    unavailable.acceptInquiry(baseInput()),
    (error) => assertRepositoryError(error, 'database-unavailable'),
  );

  const unconfigured = createContactInquiryRepository(async () => {
    throw Object.assign(new Error('CONTACT_DATABASE_URL is missing'), {
      code: 'CONTACT_DATABASE_UNAVAILABLE',
    });
  });
  await assert.rejects(
    unconfigured.acceptInquiry(baseInput()),
    (error) => assertRepositoryError(error, 'database-unavailable'),
  );

  const internal = createContactInquiryRepository(async () => {
    throw Object.assign(new Error('raw SQL with private message'), {
      code: '23505',
    });
  });
  await assert.rejects(
    internal.acceptInquiry(baseInput()),
    (error) => assertRepositoryError(error, 'internal-failure'),
  );
});

test('Neon adapter uses a lock plus one parameterized atomic persistence statement', async () => {
  type Query = { text: string; values: unknown[] };
  let captured: Query[] = [];
  const fakeTag = (strings: TemplateStringsArray, ...values: unknown[]) => ({
    text: strings.join('$'),
    values,
  });
  fakeTag.transaction = async (queries: unknown[]) => {
    captured = queries as unknown as Query[];
    return [[], [{
      contact_id: '30000000-0000-4000-8000-000000000003',
      created_at: '2026-11-17T12:00:00.000Z',
      inquiry_id: '40000000-0000-4000-8000-000000000004',
      outcome: 'created',
    }]];
  };
  const tag = fakeTag as unknown as NeonQueryFunction<false, false>;

  const persist = createNeonContactPersistence(() => tag);
  const repository = createContactInquiryRepository(persist);
  await repository.acceptInquiry(baseInput());

  assert.equal(captured.length, 2);
  assert.match(captured[0].text, /pg_advisory_xact_lock/iu);
  assert.match(captured[1].text, /INSERT INTO contact\.contacts/iu);
  assert.match(captured[1].text, /INSERT INTO contact\.inquiries/iu);
  assert.match(captured[1].text, /INSERT INTO contact\.notification_outbox/iu);
  assert.match(captured[1].text, /ON CONFLICT \(normalized_email\)/iu);
  assert.match(captured[1].text, /internal_alert/iu);
  assert.match(captured[1].text, /visitor_acknowledgement/iu);
  assert.ok(captured[1].values.includes(CONTACT_RETENTION_POLICY_VERSION));
  assert.doesNotMatch(captured[1].text, /Client@Example\.test/iu);
});
