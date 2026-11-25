import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildInvitationPrefill,
  invitationDisplayName,
  parseOptionalAdminValue,
  validateInvitationExtensionDays,
  validateOptionalInquiryId,
} from '../../scripts/discovery-admin-core';

test('structured invitation values override compatible inquiry values', () => {
  const prefill = buildInvitationPrefill({
    company: parseOptionalAdminValue('Acme'),
    email: 'owner@example.invalid',
    firstName: parseOptionalAdminValue('Marco'),
    inquiryEmail: 'inquiry@example.invalid',
    lastName: parseOptionalAdminValue('Rossi'),
  });
  assert.deepEqual(prefill, {
    companyClient: 'Acme',
    email: 'owner@example.invalid',
    firstName: 'Marco',
    lastName: 'Rossi',
  });
});

test('intentional empty structured values remain present', () => {
  const prefill = buildInvitationPrefill({
    company: parseOptionalAdminValue('-'),
    email: 'owner@example.invalid',
    firstName: parseOptionalAdminValue('-'),
    lastName: parseOptionalAdminValue(''),
  });
  assert.equal(Object.hasOwn(prefill, 'companyClient'), true);
  assert.equal(prefill.companyClient, '');
  assert.equal(Object.hasOwn(prefill, 'firstName'), true);
  assert.equal(Object.hasOwn(prefill, 'lastName'), false);
});

test('unstructured inquiry names are used only for administration display', () => {
  assert.equal(
    invitationDisplayName({
      company: parseOptionalAdminValue(''),
      firstName: parseOptionalAdminValue(''),
      inquiryDisplayName: 'Unstructured Client Name',
      lastName: parseOptionalAdminValue(''),
    }),
    'Unstructured Client Name',
  );
});

test('inquiry IDs and active-invitation extension limits are validated', () => {
  assert.equal(validateOptionalInquiryId(''), null);
  assert.throws(() => validateOptionalInquiryId('not-a-uuid'));
  assert.equal(validateInvitationExtensionDays('14'), 14);
  for (const invalid of ['0', '366', '1.5', '']) {
    assert.throws(() => validateInvitationExtensionDays(invalid));
  }
});

test('administration associates by inquiry ID and never extends inactive invitations', async () => {
  const source = await readFile('scripts/discovery-admin.ts', 'utf8');
  assert.match(source, /WHERE id = \$\{inquiryId\}::uuid/u);
  assert.doesNotMatch(source, /WHERE lower\([^)]*email/iu);
  assert.match(source, /revoked_at IS NULL[\s\S]*expires_at > now\(\)/u);
});
