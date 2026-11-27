import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import {
  generateDiscoveryCredential,
  hashDiscoveryCredential,
  validateDiscoveryPepper,
} from '../src/lib/discovery/credential-core';
import {
  DISCOVERY_ADMIN_URL_SERVICE,
  DISCOVERY_PEPPER_SERVICE,
  DISCOVERY_PRODUCTION_ADMIN_URL_SERVICE,
  DISCOVERY_PRODUCTION_PEPPER_SERVICE,
  readKeychainSecret,
} from './discovery-keychain';
import {
  connectDiscoveryAdministrationDatabase,
  getDiscoveryAdministrationTarget,
  parseDiscoveryAdministrationInvocation,
  prepareDiscoveryAdministrationInvitation,
  verifyDiscoveryAdministrationIdentity,
  type DiscoveryAdministrationEnvironment,
  type DiscoveryAdministrationTarget,
} from './discovery-admin-validation';
import { retrieveSubmittedBrief } from './discovery-admin-retrieval';
import {
  buildInvitationPrefill,
  invitationDisplayName,
  parseOptionalAdminValue,
  validateAdminEmail,
  validateInvitationExtensionDays,
  validateOptionalInquiryId,
} from './discovery-admin-core';

const DEFAULT_VALIDITY_DAYS = 14;
const prompt = createInterface({ input: stdin, output: stdout });
let selectedEnvironment: DiscoveryAdministrationEnvironment | undefined;
let command: string | undefined;

function requireSelectedEnvironment(): DiscoveryAdministrationEnvironment {
  if (!selectedEnvironment) throw new Error('Administration environment not selected');
  return selectedEnvironment;
}

function keychainServices(environment: DiscoveryAdministrationEnvironment) {
  return environment === 'production'
    ? {
        admin: DISCOVERY_PRODUCTION_ADMIN_URL_SERVICE,
        pepper: DISCOVERY_PRODUCTION_PEPPER_SERVICE,
      }
    : {
        admin: DISCOVERY_ADMIN_URL_SERVICE,
        pepper: DISCOVERY_PEPPER_SERVICE,
      };
}

async function getAdministrationContext(): Promise<{
  sql: NeonQueryFunction<false, false>;
  target: DiscoveryAdministrationTarget;
}> {
  const environment = requireSelectedEnvironment();
  const target = getDiscoveryAdministrationTarget(environment);
  const connectionString = readKeychainSecret(keychainServices(environment).admin);
  const sql = connectDiscoveryAdministrationDatabase(
    connectionString,
    target,
    (validated) => neon(validated),
  );
  await verifyDiscoveryAdministrationIdentity(sql, target);
  return { sql, target };
}

function getInvitationPepper(): string {
  const environment = requireSelectedEnvironment();
  return validateDiscoveryPepper(
    readKeychainSecret(keychainServices(environment).pepper),
  );
}

async function confirmProductionAction(action: string): Promise<void> {
  if (requireSelectedEnvironment() !== 'production') return;
  const phrase = `PRODUCTION ${action}`;
  const confirmation = (await prompt.question(`Type ${phrase} to confirm: `)).trim();
  if (confirmation !== phrase) throw new Error('Production operation cancelled');
}

async function askRequired(label: string): Promise<string> {
  const value = (await prompt.question(label)).trim();
  if (!value) throw new Error('A required value was not provided');
  return value;
}

async function askOptional(label: string) {
  return parseOptionalAdminValue(await prompt.question(label));
}

async function copyInvitationLink(link: string): Promise<void> {
  const result = spawnSync('/usr/bin/pbcopy', [], {
    input: link,
    encoding: 'utf8',
    stdio: ['pipe', 'ignore', 'ignore'],
  });
  if (result.status !== 0) {
    throw new Error('The invitation link could not be copied to the clipboard');
  }
}

async function createInvitation() {
  const environment = requireSelectedEnvironment();
  const target = getDiscoveryAdministrationTarget(environment);
  const { baseUrl, database: sql } = prepareDiscoveryAdministrationInvitation({
    baseUrl: process.env.DISCOVERY_BASE_URL,
    connectionString: readKeychainSecret(keychainServices(environment).admin),
    connect: (validated) => neon(validated),
    target,
  });
  await verifyDiscoveryAdministrationIdentity(sql, target);
  await confirmProductionAction('CREATE');
  const inquiryId = validateOptionalInquiryId(
    await prompt.question('Associated contact inquiry ID (optional): '),
  );
  const inquiryRows = inquiryId
    ? await sql`
        SELECT submitted_name, submitted_email
        FROM contact.inquiries
        WHERE id = ${inquiryId}::uuid
        LIMIT 1
      `
    : [];
  if (inquiryId && !inquiryRows[0]) {
    throw new Error('The contact inquiry was not found');
  }
  const firstName = await askOptional(
    'First name (optional; use - for an intentional empty value): ',
  );
  const lastName = await askOptional(
    'Last name (optional; use - for an intentional empty value): ',
  );
  const company = await askOptional(
    'Company (optional; use - for an intentional empty value): ',
  );
  const emailInput = (
    await prompt.question('Authorized email (blank uses associated inquiry): ')
  ).trim();
  const clientEmail = validateAdminEmail(
    emailInput || String(inquiryRows[0]?.submitted_email ?? ''),
  );
  const copiedInquiryFields = inquiryId && !emailInput ? '{email}' : '{}';
  const clientName = invitationDisplayName({
    company,
    firstName,
    inquiryDisplayName: inquiryRows[0]?.submitted_name,
    lastName,
  });
  const prefill = buildInvitationPrefill({
    company,
    email: clientEmail,
    firstName,
    inquiryEmail: inquiryRows[0]?.submitted_email,
    lastName,
  });
  const localeInput = (await prompt.question('Locale [en/it] (en): '))
    .trim()
    .toLowerCase();
  const locale = localeInput || 'en';
  if (locale !== 'en' && locale !== 'it') {
    throw new Error('Locale must be en or it');
  }
  const invitationId = randomUUID();
  const token = generateDiscoveryCredential();
  const tokenHash = hashDiscoveryCredential(
    token,
    'invitation',
    getInvitationPepper(),
  );
  const expiresAt = new Date(
    Date.now() + DEFAULT_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
  );

  const insertInvitation = sql`
    INSERT INTO discovery.invitations (
      id,
      token_hash,
      client_name,
      client_email,
      preferred_locale,
      expires_at,
      prefill_schema_version,
      prefill_answers
    ) VALUES (
      ${invitationId},
      ${tokenHash},
      ${clientName},
      ${clientEmail},
      ${locale},
      ${expiresAt.toISOString()}::timestamptz,
      ${'2.0'},
      ${prefill}::jsonb
    )
  `;
  if (inquiryId) {
    await sql.transaction([
      insertInvitation,
      sql`
        INSERT INTO discovery.invitation_inquiry_links (
          invitation_id,
          inquiry_id,
          copied_fields
        ) VALUES (
          ${invitationId}::uuid,
          ${inquiryId}::uuid,
          ${copiedInquiryFields}::text[]
        )
      `,
    ]);
  } else {
    await insertInvitation;
  }

  baseUrl.pathname = locale === 'it' ? '/it/discovery' : '/discovery';
  baseUrl.search = '';
  baseUrl.hash = `token=${token}`;

  try {
    await copyInvitationLink(baseUrl.toString());
  } catch (error) {
    await sql`
      UPDATE discovery.invitations
      SET
        revoked_at = now(),
        revocation_reason = ${'Clipboard delivery failed'}
      WHERE id = ${invitationId}
        AND revoked_at IS NULL
    `;
    throw error;
  }

  console.log(`Invitation created: ${invitationId}`);
  console.log(`Expires: ${expiresAt.toISOString()}`);
  console.log('Invitation link copied to the macOS clipboard.');
}

async function inspectInvitation() {
  const invitationId = await askRequired('Invitation ID: ');
  const { sql } = await getAdministrationContext();
  const rows = await sql`
    SELECT
      invitations.id,
      invitations.preferred_locale,
      invitations.lifecycle_status,
      invitations.created_at,
      invitations.expires_at,
      invitations.revoked_at,
      CASE
        WHEN invitations.revoked_at IS NOT NULL THEN 'revoked'
        WHEN invitations.expires_at <= now() THEN 'expired'
        ELSE invitations.lifecycle_status
      END AS effective_status,
      count(sessions.id)::int AS session_count,
      max(project_briefs.state) AS brief_state
    FROM discovery.invitations
    LEFT JOIN discovery.sessions
      ON sessions.invitation_id = invitations.id
    LEFT JOIN discovery.project_briefs
      ON project_briefs.invitation_id = invitations.id
    WHERE invitations.id = ${invitationId}::uuid
    GROUP BY invitations.id
  `;

  const invitation = rows[0];
  if (!invitation) throw new Error('Invitation not found');

  console.log(`Invitation: ${invitation.id}`);
  console.log(`Status: ${invitation.effective_status}`);
  console.log(`Locale: ${invitation.preferred_locale}`);
  console.log(`Created: ${new Date(invitation.created_at).toISOString()}`);
  console.log(`Expires: ${new Date(invitation.expires_at).toISOString()}`);
  console.log(`Sessions: ${invitation.session_count}`);
  console.log(`Brief: ${invitation.brief_state ?? 'none'}`);
}

async function retrieveBrief() {
  const reference = await askRequired('Submission reference: ');
  const { sql } = await getAdministrationContext();
  const brief = await retrieveSubmittedBrief(sql, reference);
  console.log(JSON.stringify(brief, null, 2));
}

async function revokeInvitation() {
  const invitationId = await askRequired('Invitation ID: ');
  const reason = await askRequired('Revocation reason: ');
  const { sql } = await getAdministrationContext();
  const confirmation = (
    await prompt.question(
      requireSelectedEnvironment() === 'production'
        ? 'Type PRODUCTION REVOKE to confirm this irreversible action: '
        : 'Type REVOKE to confirm this irreversible action: ',
    )
  ).trim();
  const expected = requireSelectedEnvironment() === 'production'
    ? 'PRODUCTION REVOKE'
    : 'REVOKE';
  if (confirmation !== expected) throw new Error('Revocation cancelled');

  const rows = await sql`
    WITH revoked AS (
      UPDATE discovery.invitations
      SET
        revoked_at = now(),
        revocation_reason = ${reason}
      WHERE id = ${invitationId}::uuid
        AND revoked_at IS NULL
      RETURNING id
    ),
    invalidated AS (
      UPDATE discovery.sessions
      SET
        invalidated_at = now(),
        invalidation_reason = ${'Invitation revoked'}
      WHERE invitation_id IN (SELECT id FROM revoked)
        AND invalidated_at IS NULL
      RETURNING id
    )
    SELECT
      (SELECT count(*)::int FROM revoked) AS revoked_count,
      (SELECT count(*)::int FROM invalidated) AS invalidated_count
  `;

  if (rows[0]?.revoked_count !== 1) {
    throw new Error('Invitation was not found or was already revoked');
  }

  console.log(`Invitation revoked: ${invitationId}`);
  console.log(`Sessions invalidated: ${rows[0].invalidated_count}`);
}

async function extendInvitation() {
  const invitationId = await askRequired('Invitation ID: ');
  const days = validateInvitationExtensionDays(
    await askRequired('Additional validity days [1-365]: '),
  );
  const { sql } = await getAdministrationContext();
  const confirmation = (
    await prompt.question(
      requireSelectedEnvironment() === 'production'
        ? `Type PRODUCTION EXTEND ${days} to confirm: `
        : `Type EXTEND ${days} to confirm: `,
    )
  ).trim();
  const expected = requireSelectedEnvironment() === 'production'
    ? `PRODUCTION EXTEND ${days}`
    : `EXTEND ${days}`;
  if (confirmation !== expected) throw new Error('Extension cancelled');

  const rows = await sql`
    UPDATE discovery.invitations
    SET expires_at = expires_at + (${days}::text || ' days')::interval
    WHERE id = ${invitationId}::uuid
      AND revoked_at IS NULL
      AND expires_at > now()
    RETURNING expires_at
  `;
  if (!rows[0]) {
    throw new Error('Invitation was not found, has expired, or was revoked');
  }
  console.log(`Invitation extended: ${invitationId}`);
  console.log(`Expires: ${new Date(rows[0].expires_at).toISOString()}`);
}

async function main() {
  try {
    const invocation = parseDiscoveryAdministrationInvocation(process.argv.slice(2));
    command = invocation.command;
    selectedEnvironment = invocation.environment;
    if (command === 'create') await createInvitation();
    else if (command === 'inspect') await inspectInvitation();
    else if (command === 'retrieve') await retrieveBrief();
    else if (command === 'revoke') await revokeInvitation();
    else if (command === 'extend') await extendInvitation();
    else {
      throw new Error(
        'Usage: npm run discovery:admin -- --environment <validation|production> <create|inspect|retrieve|revoke|extend>',
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Operation failed';
    console.error(`Discovery administration failed: ${message}`);
    process.exitCode = 1;
  } finally {
    prompt.close();
  }
}

void main();
