import assert from 'node:assert/strict';
import test from 'node:test';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import {
  retrieveSubmittedBrief,
  validateSubmissionReference,
} from '../../scripts/discovery-admin-retrieval';

test('submitted brief retrieval is a single read-only reference lookup', async () => {
  const queries: string[] = [];
  const sql = (async (strings: TemplateStringsArray) => {
    queries.push(strings.join('?'));
    return [{
      answers: { projectType: 'newWebsite' },
      client_email: 'client@example.test',
      client_name: 'Example Client',
      locale: 'en',
      schema_version: '2.0',
      submission_reference: 'CV-2026-A1B2C3D4E5F6',
      submitted_at: '2026-11-27T12:00:00.000Z',
    }];
  }) as unknown as NeonQueryFunction<false, false>;

  const brief = await retrieveSubmittedBrief(sql, 'cv-2026-a1b2c3d4e5f6');
  assert.equal(brief.submissionReference, 'CV-2026-A1B2C3D4E5F6');
  assert.deepEqual(brief.answers, { projectType: 'newWebsite' });
  assert.match(queries[0], /WHERE briefs\.submission_reference/u);
  assert.match(queries[0], /briefs\.state = 'submitted'/u);
  assert.doesNotMatch(queries[0], /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP)\b/iu);
});

test('malformed references and missing submitted briefs are rejected', async () => {
  for (const value of ['', 'CV-2026-TOO-SHORT', 'OTHER-2026-A1B2C3D4E5F6']) {
    assert.throws(() => validateSubmissionReference(value), /Invalid/u);
  }
  const sql = (async () => []) as unknown as NeonQueryFunction<false, false>;
  await assert.rejects(
    retrieveSubmittedBrief(sql, 'CV-2026-A1B2C3D4E5F6'),
    /not found/u,
  );
});
