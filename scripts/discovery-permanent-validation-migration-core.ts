import {
  PERMANENT_VALIDATION_APPLIED_MIGRATIONS,
  PERMANENT_VALIDATION_PENDING_MIGRATION,
  type PermanentValidationChecksums,
} from './discovery-permanent-validation-preflight-core';

export const PERMANENT_VALIDATION_MIGRATION_AUTHORIZATION =
  'discovery-validation-apply-0004';
export const PERMANENT_VALIDATION_MIGRATION_CHECKSUM =
  '8d4114d3b7a6ef67832abe89e6d966fae3df673bf0fdeabed26aa13b35275757';

export type PermanentValidationRecordCounts = {
  invitations: number;
  notificationEvents: number;
  projectBriefs: number;
};

export type PermanentValidationMigrationState = {
  migrations: Array<{ checksum: string; version: string }>;
  recordCounts: PermanentValidationRecordCounts;
  submittedBriefs: number;
};

export type PermanentValidationPostMigrationState = {
  columns: string[];
  functions: Array<{
    name: string;
    owner: string;
    publicExecute: boolean;
    runtimeExecute: boolean;
    searchPathPinned: boolean;
  }>;
  migrations: Array<{ checksum: string; version: string }>;
  permissions: {
    outboxDeliveryUpdate: boolean;
    outboxInsert: boolean;
    stateUpdate: boolean;
    submissionReferenceUpdate: boolean;
  };
  recordCounts: PermanentValidationRecordCounts;
};

const SECURED_FUNCTIONS = new Set([
  'claim_notification_events',
  'mark_notification_delivered',
  'mark_notification_failed',
  'submit_project_brief',
]);
const REQUIRED_COLUMNS = new Set([
  'notification_outbox.provider_message_id',
  'project_briefs.submission_idempotency_id',
  'project_briefs.submission_payload_hash',
]);

function validateCounts(counts: PermanentValidationRecordCounts): void {
  if (
    !Number.isInteger(counts.invitations)
    || counts.invitations < 0
    || !Number.isInteger(counts.projectBriefs)
    || counts.projectBriefs < 0
    || !Number.isInteger(counts.notificationEvents)
    || counts.notificationEvents < 0
  ) {
    throw new Error('Permanent validation migration: invalid record counts');
  }
}

function verifyMigrationHistory(
  migrations: PermanentValidationMigrationState['migrations'],
  expectedVersions: readonly string[],
  checksums: PermanentValidationChecksums,
): void {
  if (migrations.length !== expectedVersions.length) {
    throw new Error('Permanent validation migration: unexpected migration state');
  }
  for (const version of expectedVersions) {
    const match = migrations.find((migration) => migration.version === version);
    if (!match || match.checksum !== checksums[version as keyof typeof checksums]) {
      throw new Error('Permanent validation migration: migration checksum mismatch');
    }
  }
}

export function parsePermanentValidationMigrationInvocation(argv: string[]): void {
  if (argv.length !== 1 || argv[0] !== 'apply-0004') {
    throw new Error(
      'Usage: npm run discovery:validation:migrate -- apply-0004',
    );
  }
}

export function requirePermanentValidationMigrationAuthorization(
  value: string | undefined,
): void {
  if (value !== PERMANENT_VALIDATION_MIGRATION_AUTHORIZATION) {
    throw new Error(
      'Permanent validation migration: explicit migration authorization is required',
    );
  }
}

export function verifyPermanentValidationPreMigrationState(input: {
  checksums: PermanentValidationChecksums;
  repositoryMigrations: string[];
  state: PermanentValidationMigrationState;
}): void {
  if (
    input.checksums[PERMANENT_VALIDATION_PENDING_MIGRATION]
      !== PERMANENT_VALIDATION_MIGRATION_CHECKSUM
  ) {
    throw new Error('Permanent validation migration: migration 0004 checksum mismatch');
  }
  const expectedRepositoryMigrations = [
    ...PERMANENT_VALIDATION_APPLIED_MIGRATIONS,
    PERMANENT_VALIDATION_PENDING_MIGRATION,
  ];
  if (
    input.repositoryMigrations.length !== expectedRepositoryMigrations.length
    || expectedRepositoryMigrations.some(
      (migration, index) => input.repositoryMigrations[index] !== migration,
    )
  ) {
    throw new Error('Permanent validation migration: unexpected repository migrations');
  }
  verifyMigrationHistory(
    input.state.migrations,
    PERMANENT_VALIDATION_APPLIED_MIGRATIONS,
    input.checksums,
  );
  if (input.state.submittedBriefs !== 0) {
    throw new Error('Permanent validation migration: submitted briefs block migration');
  }
  validateCounts(input.state.recordCounts);
}

export function verifyPermanentValidationPostMigrationState(input: {
  checksums: PermanentValidationChecksums;
  post: PermanentValidationPostMigrationState;
  preCounts: PermanentValidationRecordCounts;
}): void {
  verifyMigrationHistory(
    input.post.migrations,
    [
      ...PERMANENT_VALIDATION_APPLIED_MIGRATIONS,
      PERMANENT_VALIDATION_PENDING_MIGRATION,
    ],
    input.checksums,
  );
  validateCounts(input.post.recordCounts);
  if (
    input.post.recordCounts.invitations !== input.preCounts.invitations
    || input.post.recordCounts.projectBriefs !== input.preCounts.projectBriefs
    || input.post.recordCounts.notificationEvents !== input.preCounts.notificationEvents
  ) {
    throw new Error('Permanent validation migration: existing record counts changed');
  }
  if (
    input.post.columns.length !== REQUIRED_COLUMNS.size
    || input.post.columns.some((column) => !REQUIRED_COLUMNS.has(column))
  ) {
    throw new Error('Permanent validation migration: required columns mismatch');
  }
  if (
    input.post.functions.length !== SECURED_FUNCTIONS.size
    || input.post.functions.some((fn) =>
      !SECURED_FUNCTIONS.has(fn.name)
      || fn.owner !== 'codevivo_discovery_migration'
      || !fn.searchPathPinned
      || fn.publicExecute
      || !fn.runtimeExecute
    )
  ) {
    throw new Error('Permanent validation migration: secured function mismatch');
  }
  if (
    input.post.permissions.stateUpdate
    || input.post.permissions.submissionReferenceUpdate
    || input.post.permissions.outboxInsert
    || input.post.permissions.outboxDeliveryUpdate
  ) {
    throw new Error('Permanent validation migration: runtime permission mismatch');
  }
}

export async function executeAuthorizedPermanentValidationMigration(input: {
  authorization?: string;
  execute(): Promise<void>;
  preflight(): Promise<void>;
}): Promise<void> {
  requirePermanentValidationMigrationAuthorization(input.authorization);
  await input.preflight();
  await input.execute();
}
