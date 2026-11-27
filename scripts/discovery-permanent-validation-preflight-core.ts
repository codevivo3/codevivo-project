export const PERMANENT_VALIDATION_PROJECT_ID = 'round-tree-42808727';
export const PERMANENT_VALIDATION_BRANCH_NAME = 'discovery-validation';
export const PERMANENT_VALIDATION_BRANCH_ID = 'br-winter-block-bagymuuk';
export const PERMANENT_VALIDATION_PARENT_BRANCH_NAME = 'production';
export const PERMANENT_VALIDATION_PARENT_BRANCH_ID =
  'br-wispy-breeze-bakkpibs';
export const PERMANENT_VALIDATION_ENDPOINT_ID = 'ep-late-sea-bas88ozp';
export const PERMANENT_VALIDATION_REGION_ID = 'aws-eu-central-1';
export const PERMANENT_VALIDATION_DATABASE = 'neondb';
export const PERMANENT_VALIDATION_DIRECT_HOST =
  'ep-late-sea-bas88ozp.c-8.eu-central-1.aws.neon.tech';
export const PERMANENT_VALIDATION_POOLED_HOST =
  'ep-late-sea-bas88ozp-pooler.c-8.eu-central-1.aws.neon.tech';
export const PERMANENT_VALIDATION_AUTHORIZATION =
  'discovery-validation-read-only-preflight';

export const PERMANENT_VALIDATION_KEYCHAIN_SERVICES = {
  apiKey: 'codevivo.discovery.recovery.neon-api-key',
  admin: 'codevivo.discovery.admin.database-url',
  migration: 'codevivo.discovery.migration.database-url',
  runtime: 'codevivo.discovery.runtime.database-url',
} as const;

const ROLES = {
  admin: 'codevivo_discovery_admin',
  migration: 'codevivo_discovery_migration',
  runtime: 'codevivo_discovery_runtime',
} as const;

export const PERMANENT_VALIDATION_APPLIED_MIGRATIONS = [
  '0001_project_discovery_foundation.sql',
  '0002_contact_database_foundation.sql',
  '0003_discovery_persistence_foundation.sql',
] as const;
export const PERMANENT_VALIDATION_PENDING_MIGRATION =
  '0004_discovery_final_submission.sql';

type ConnectionKind = keyof typeof ROLES;
export type PermanentValidationConnections = Record<ConnectionKind, string>;

export type PermanentValidationBranch = {
  expires_at?: string | null;
  id?: string;
  name?: string;
  parent_id?: string | null;
};

export type PermanentValidationEndpoint = {
  branch_id?: string;
  host?: string;
  id?: string;
  region_id?: string;
  type?: string;
};

export type PermanentValidationMetadata = {
  branch: PermanentValidationBranch;
  endpoints: PermanentValidationEndpoint[];
  parent: PermanentValidationBranch;
};

export type PermanentValidationEvidence = {
  functions: Array<{
    name: string;
    owner: string;
    publicExecute: boolean;
    runtimeExecute: boolean;
  }>;
  identities: Record<ConnectionKind, {
    database: string;
    readOnly: boolean;
    role: string;
    serverVersion: number;
  }>;
  migrations: Array<{ checksum: string; version: string }>;
  permissions: {
    answersUpdate: boolean;
    contactUsage: boolean;
    outboxDeliveryUpdate: boolean;
    outboxInsert: boolean;
    provenanceSelect: boolean;
    publicSchemaUsage: boolean;
    stateUpdate: boolean;
    submissionIdempotencyColumn: boolean;
    submissionReferenceUpdate: boolean;
    submittedImmutableTrigger: boolean;
    providerMessageColumn: boolean;
  };
  roles: Array<{
    bypassRls: boolean;
    canLogin: boolean;
    createDb: boolean;
    createRole: boolean;
    memberOfAdmin: boolean;
    memberOfMigration: boolean;
    name: string;
    replication: boolean;
    superuser: boolean;
  }>;
  schemas: Array<{ name: string; owner: string }>;
  submittedBriefs: number;
};

export type PermanentValidationChecksums = Record<
  | (typeof PERMANENT_VALIDATION_APPLIED_MIGRATIONS)[number]
  | typeof PERMANENT_VALIDATION_PENDING_MIGRATION,
  string
>;

function validateConnection(kind: ConnectionKind, connectionString: string): void {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(`Permanent validation preflight: malformed ${kind} URL`);
  }
  const pooled = kind === 'runtime';
  const expectedHost = pooled
    ? PERMANENT_VALIDATION_POOLED_HOST
    : PERMANENT_VALIDATION_DIRECT_HOST;
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== expectedHost
    || decodeURIComponent(url.pathname.slice(1)) !== PERMANENT_VALIDATION_DATABASE
    || decodeURIComponent(url.username) !== ROLES[kind]
    || !url.password
    || url.hostname.includes('-pooler') !== pooled
  ) {
    throw new Error(`Permanent validation preflight: unsafe ${kind} target`);
  }
}

export function validatePermanentValidationConnections(
  connections: PermanentValidationConnections,
): void {
  for (const kind of Object.keys(ROLES) as ConnectionKind[]) {
    validateConnection(kind, connections[kind]);
  }
}

export function parsePermanentValidationPreflightInvocation(argv: string[]): void {
  if (argv.length !== 1 || argv[0] !== 'preflight') {
    throw new Error(
      'Usage: npm run discovery:validation:preflight -- preflight',
    );
  }
}

export function verifyPermanentValidationTarget(input: {
  authorization?: string;
  connections: PermanentValidationConnections;
  metadata: PermanentValidationMetadata;
}): { branchId: string; endpointId: string; parentBranchId: string } {
  if (input.authorization !== PERMANENT_VALIDATION_AUTHORIZATION) {
    throw new Error(
      'Permanent validation preflight: explicit read-only authorization is required',
    );
  }
  validatePermanentValidationConnections(input.connections);

  const { branch, endpoints, parent } = input.metadata;
  if (
    branch.id !== PERMANENT_VALIDATION_BRANCH_ID
    || branch.name !== PERMANENT_VALIDATION_BRANCH_NAME
  ) {
    throw new Error('Permanent validation preflight: branch identity mismatch');
  }
  if (branch.expires_at) {
    throw new Error('Permanent validation preflight: permanent branch unexpectedly expires');
  }
  if (
    branch.parent_id !== PERMANENT_VALIDATION_PARENT_BRANCH_ID
    || parent.id !== PERMANENT_VALIDATION_PARENT_BRANCH_ID
    || parent.name !== PERMANENT_VALIDATION_PARENT_BRANCH_NAME
  ) {
    throw new Error('Permanent validation preflight: parent branch identity mismatch');
  }

  const matches = endpoints.filter((endpoint) =>
    endpoint.branch_id === branch.id
    && endpoint.type === 'read_write'
    && endpoint.host === PERMANENT_VALIDATION_DIRECT_HOST
    && endpoint.region_id === PERMANENT_VALIDATION_REGION_ID
  );
  if (matches.length !== 1 || matches[0]?.id !== PERMANENT_VALIDATION_ENDPOINT_ID) {
    throw new Error('Permanent validation preflight: endpoint identity mismatch');
  }
  return {
    branchId: branch.id,
    endpointId: matches[0].id,
    parentBranchId: parent.id,
  };
}

const EXPECTED_FUNCTIONS = new Set([
  'prevent_revoked_invitation_update',
  'prevent_submitted_brief_update',
  'set_updated_at',
]);

export function verifyPermanentValidationEvidence(input: {
  checksums: PermanentValidationChecksums;
  evidence: PermanentValidationEvidence;
}): void {
  const { checksums, evidence } = input;
  for (const kind of Object.keys(ROLES) as ConnectionKind[]) {
    const identity = evidence.identities[kind];
    if (
      identity.database !== PERMANENT_VALIDATION_DATABASE
      || identity.role !== ROLES[kind]
      || identity.serverVersion < 180000
      || identity.readOnly !== true
    ) {
      throw new Error(`Permanent validation preflight: ${kind} identity mismatch`);
    }
  }

  for (const schema of ['contact', 'discovery']) {
    const match = evidence.schemas.find((row) => row.name === schema);
    if (match?.owner !== ROLES.migration) {
      throw new Error('Permanent validation preflight: schema ownership mismatch');
    }
  }
  if (evidence.schemas.length !== 2) {
    throw new Error('Permanent validation preflight: unexpected schema state');
  }

  const expectedVersions = new Set(PERMANENT_VALIDATION_APPLIED_MIGRATIONS);
  if (evidence.migrations.length !== expectedVersions.size) {
    throw new Error('Permanent validation preflight: unknown migration state');
  }
  for (const migration of evidence.migrations) {
    if (
      !expectedVersions.has(
        migration.version as (typeof PERMANENT_VALIDATION_APPLIED_MIGRATIONS)[number],
      )
      || migration.checksum !== checksums[
        migration.version as (typeof PERMANENT_VALIDATION_APPLIED_MIGRATIONS)[number]
      ]
    ) {
      throw new Error('Permanent validation preflight: migration history mismatch');
    }
  }
  if (evidence.migrations.some(
    (migration) => migration.version === PERMANENT_VALIDATION_PENDING_MIGRATION,
  )) {
    throw new Error('Permanent validation preflight: migration 0004 is not pending');
  }
  if (!/^[a-f0-9]{64}$/u.test(checksums[PERMANENT_VALIDATION_PENDING_MIGRATION])) {
    throw new Error('Permanent validation preflight: migration 0004 checksum unavailable');
  }
  if (evidence.submittedBriefs !== 0) {
    throw new Error('Permanent validation preflight: existing submitted briefs block migration');
  }

  const expectedRoles = new Set(Object.values(ROLES));
  if (evidence.roles.length !== expectedRoles.size) {
    throw new Error('Permanent validation preflight: unexpected role state');
  }
  for (const role of evidence.roles) {
    if (
      !expectedRoles.has(role.name as (typeof ROLES)[ConnectionKind])
      || !role.canLogin
      || role.superuser
      || role.createDb
      || role.createRole
      || role.replication
      || role.bypassRls
      || role.memberOfAdmin
      || role.memberOfMigration
    ) {
      throw new Error('Permanent validation preflight: role privilege mismatch');
    }
  }

  if (
    evidence.functions.length !== EXPECTED_FUNCTIONS.size
    || evidence.functions.some((fn) =>
      !EXPECTED_FUNCTIONS.has(fn.name)
      || fn.owner !== ROLES.migration
      || fn.publicExecute
      || fn.runtimeExecute
    )
  ) {
    throw new Error('Permanent validation preflight: function privilege mismatch');
  }

  const permissions = evidence.permissions;
  if (
    permissions.answersUpdate !== true
    || permissions.stateUpdate !== false
    || permissions.submissionReferenceUpdate !== false
    || permissions.contactUsage !== false
    || permissions.provenanceSelect !== false
    || permissions.publicSchemaUsage !== false
    || permissions.outboxInsert !== true
    || permissions.outboxDeliveryUpdate !== true
    || permissions.submittedImmutableTrigger !== true
    || permissions.providerMessageColumn !== false
    || permissions.submissionIdempotencyColumn !== false
  ) {
    throw new Error('Permanent validation preflight: runtime permission mismatch');
  }
}

export async function fetchPermanentValidationMetadata(input: {
  apiKey: string;
  fetchImplementation?: typeof fetch;
}): Promise<PermanentValidationMetadata> {
  const fetchImplementation = input.fetchImplementation ?? fetch;
  const base =
    `https://console.neon.tech/api/v2/projects/${PERMANENT_VALIDATION_PROJECT_ID}`;
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${input.apiKey}`,
  };
  const branchResponse = await fetchImplementation(
    `${base}/branches/${PERMANENT_VALIDATION_BRANCH_ID}`,
    { headers, method: 'GET' },
  );
  if (!branchResponse.ok) {
    throw new Error('Permanent validation preflight: Neon branch lookup failed');
  }
  const branchBody = (await branchResponse.json()) as {
    branch?: PermanentValidationBranch;
  };
  if (!branchBody.branch?.parent_id) {
    throw new Error('Permanent validation preflight: invalid branch metadata');
  }

  const [endpointResponse, parentResponse] = await Promise.all([
    fetchImplementation(
      `${base}/branches/${PERMANENT_VALIDATION_BRANCH_ID}/endpoints`,
      { headers, method: 'GET' },
    ),
    fetchImplementation(
      `${base}/branches/${encodeURIComponent(branchBody.branch.parent_id)}`,
      { headers, method: 'GET' },
    ),
  ]);
  if (!endpointResponse.ok || !parentResponse.ok) {
    throw new Error('Permanent validation preflight: Neon relationship lookup failed');
  }
  const endpointBody = (await endpointResponse.json()) as {
    endpoints?: PermanentValidationEndpoint[];
  };
  const parentBody = (await parentResponse.json()) as {
    branch?: PermanentValidationBranch;
  };
  if (!Array.isArray(endpointBody.endpoints) || !parentBody.branch?.id) {
    throw new Error('Permanent validation preflight: invalid Neon metadata');
  }
  return {
    branch: branchBody.branch,
    endpoints: endpointBody.endpoints,
    parent: parentBody.branch,
  };
}
