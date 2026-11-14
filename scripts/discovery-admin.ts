import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { neon } from '@neondatabase/serverless';
import {
  generateDiscoveryCredential,
  hashDiscoveryCredential,
  validateDiscoveryPepper,
} from '../src/lib/discovery/credential-core';
import {
  DISCOVERY_ADMIN_URL_SERVICE,
  DISCOVERY_PEPPER_SERVICE,
  readKeychainSecret,
} from './discovery-keychain';

const DEFAULT_VALIDITY_DAYS = 14;
const command = process.argv[2];
const prompt = createInterface({ input: stdin, output: stdout });

function getAdministrationDatabase() {
  const connectionString = readKeychainSecret(DISCOVERY_ADMIN_URL_SERVICE);
  const url = new URL(connectionString);
  const role = decodeURIComponent(url.username);

  if (
    !url.protocol.startsWith('postgres') ||
    role !== 'codevivo_discovery_admin' ||
    url.pathname !== '/neondb' ||
    url.hostname.includes('-pooler')
  ) {
    throw new Error(
      'The administration Keychain item must use the direct neondb URL and administration role',
    );
  }

  return neon(connectionString);
}

function getInvitationPepper(): string {
  return validateDiscoveryPepper(readKeychainSecret(DISCOVERY_PEPPER_SERVICE));
}

async function askRequired(label: string): Promise<string> {
  const value = (await prompt.question(label)).trim();
  if (!value) throw new Error('A required value was not provided');
  return value;
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
  const clientName = await askRequired('Client or company name: ');
  const clientEmail = await askRequired('Client email: ');
  const localeInput = (await prompt.question('Locale [en/it] (en): '))
    .trim()
    .toLowerCase();
  const locale = localeInput || 'en';
  if (locale !== 'en' && locale !== 'it') {
    throw new Error('Locale must be en or it');
  }

  const sql = getAdministrationDatabase();
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

  await sql`
    INSERT INTO discovery.invitations (
      id,
      token_hash,
      client_name,
      client_email,
      preferred_locale,
      expires_at
    ) VALUES (
      ${invitationId},
      ${tokenHash},
      ${clientName},
      ${clientEmail},
      ${locale},
      ${expiresAt.toISOString()}::timestamptz
    )
  `;

  const baseUrl = new URL(
    process.env.DISCOVERY_BASE_URL || 'https://codevivo.dev',
  );
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
  const sql = getAdministrationDatabase();
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

async function revokeInvitation() {
  const invitationId = await askRequired('Invitation ID: ');
  const reason = await askRequired('Revocation reason: ');
  const confirmation = (
    await prompt.question('Type REVOKE to confirm this irreversible action: ')
  ).trim();
  if (confirmation !== 'REVOKE') throw new Error('Revocation cancelled');

  const sql = getAdministrationDatabase();
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

async function main() {
  try {
    if (command === 'create') await createInvitation();
    else if (command === 'inspect') await inspectInvitation();
    else if (command === 'revoke') await revokeInvitation();
    else {
      throw new Error('Usage: npm run discovery:admin -- <create|inspect|revoke>');
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
