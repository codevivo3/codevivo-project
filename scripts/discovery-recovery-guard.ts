export const RECOVERY_PROJECT_ID = 'round-tree-42808727';
export const RECOVERY_BRANCH_NAME = 'recovery-gate-20261114';
export const RECOVERY_BRANCH_ID = 'br-sparkling-lab-baigfr0y';
export const RECOVERY_ENDPOINT_ID = 'ep-steep-cake-ba0bo6a8';
export const RECOVERY_ENDPOINT_HOST =
  'ep-steep-cake-ba0bo6a8.c-8.eu-central-1.aws.neon.tech';
export const RECOVERY_DATABASE_NAME = 'codevivo_recovery_gate';
export const RECOVERY_AUTHORIZATION = 'recovery-gate-20261114';
export const SOURCE_BRANCH_ID = 'br-winter-block-bagymuuk';
export const SOURCE_ENDPOINT_ID = 'ep-late-sea-bas88ozp';
export const SOURCE_ENDPOINT_HOST =
  'ep-late-sea-bas88ozp.c-8.eu-central-1.aws.neon.tech';
export const SOURCE_DATABASE_NAME = 'neondb';
export const MINIMUM_RECOVERY_LIFETIME_MS = 3 * 60 * 60 * 1000;

export const RECOVERY_KEYCHAIN_SERVICES = {
  apiKey: 'codevivo.discovery.recovery.neon-api-key',
  runtime: 'codevivo.discovery.recovery.runtime.database-url',
  admin: 'codevivo.discovery.recovery.admin.database-url',
  migration: 'codevivo.discovery.recovery.migration.database-url',
  sourceMigration: 'codevivo.discovery.migration.database-url',
} as const;

const APPROVED_CONNECTIONS = {
  runtime: 'codevivo_discovery_runtime',
  admin: 'codevivo_discovery_admin',
  migration: 'codevivo_discovery_migration',
} as const;

export interface RecoveryEnvironment {
  DISCOVERY_RECOVERY_TEST_ALLOW?: string;
  DISCOVERY_RECOVERY_BRANCH_ID?: string;
  DISCOVERY_RECOVERY_ENDPOINT_ID?: string;
}

interface NeonBranch {
  id?: string;
  name?: string;
  parent_id?: string;
  expires_at?: string;
}

interface NeonEndpoint {
  id?: string;
  branch_id?: string;
  host?: string;
  type?: string;
}

export interface RecoveryMetadata {
  branch: NeonBranch;
  endpoints: NeonEndpoint[];
}

export interface RecoveryConnectionUrls {
  runtime: string;
  admin: string;
  migration: string;
}

export interface VerifiedRecoveryTarget {
  branchId: string;
  endpointId: string;
  hostname: string;
  expiresAt: string;
}

function required(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Recovery test guard: missing ${label}`);
  }

  return value;
}

function validateConnectionUrl(
  label: keyof RecoveryConnectionUrls,
  connectionString: string,
  hostname: string,
) {
  let url: URL;

  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(`Recovery test guard: malformed ${label} connection URL`);
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error(`Recovery test guard: invalid ${label} connection protocol`);
  }

  if (url.hostname.includes('-pooler') || url.hostname !== hostname) {
    throw new Error(`Recovery test guard: invalid ${label} connection hostname`);
  }

  if (
    url.hostname.startsWith(`${SOURCE_ENDPOINT_ID}.`) ||
    url.hostname.startsWith(`${SOURCE_ENDPOINT_ID}-pooler.`)
  ) {
    throw new Error('Recovery test guard: source validation endpoint rejected');
  }

  if (decodeURIComponent(url.pathname.slice(1)) !== RECOVERY_DATABASE_NAME) {
    throw new Error(`Recovery test guard: invalid ${label} database`);
  }

  if (decodeURIComponent(url.username) !== APPROVED_CONNECTIONS[label]) {
    throw new Error(`Recovery test guard: invalid ${label} database role`);
  }
}

export function verifyRecoveryTestConfiguration(input: {
  environment: RecoveryEnvironment;
  metadata: RecoveryMetadata;
  connections: RecoveryConnectionUrls;
  now?: Date;
  minimumRemainingMs?: number;
}): VerifiedRecoveryTarget {
  const { environment, metadata, connections } = input;
  const now = input.now ?? new Date();
  const minimumRemainingMs =
    input.minimumRemainingMs ?? MINIMUM_RECOVERY_LIFETIME_MS;

  if (
    environment.DISCOVERY_RECOVERY_TEST_ALLOW !== RECOVERY_AUTHORIZATION
  ) {
    throw new Error('Recovery test guard: explicit authorization is required');
  }

  const branchId = required(
    environment.DISCOVERY_RECOVERY_BRANCH_ID,
    'recovery branch ID',
  );
  const endpointId = required(
    environment.DISCOVERY_RECOVERY_ENDPOINT_ID,
    'recovery endpoint ID',
  );

  if (
    branchId !== RECOVERY_BRANCH_ID ||
    endpointId !== RECOVERY_ENDPOINT_ID
  ) {
    throw new Error('Recovery test guard: source validation target rejected');
  }

  if (
    metadata.branch.id !== branchId ||
    metadata.branch.name !== RECOVERY_BRANCH_NAME ||
    metadata.branch.parent_id !== SOURCE_BRANCH_ID
  ) {
    throw new Error('Recovery test guard: Neon branch identity mismatch');
  }

  const expiresAt = required(
    metadata.branch.expires_at,
    'recovery branch expiration',
  );
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now.getTime()) {
    throw new Error('Recovery test guard: recovery branch is expired');
  }
  if (expiresAtMs - now.getTime() < minimumRemainingMs) {
    throw new Error(
      'Recovery test guard: insufficient recovery branch lifetime',
    );
  }

  const matchingEndpoints = metadata.endpoints.filter(
    (endpoint) =>
      endpoint.id === endpointId &&
      endpoint.branch_id === branchId &&
      endpoint.type === 'read_write',
  );

  if (matchingEndpoints.length !== 1) {
    throw new Error('Recovery test guard: Neon endpoint identity mismatch');
  }

  const hostname = required(
    matchingEndpoints[0].host,
    'recovery endpoint hostname',
  ).toLowerCase();

  if (
    hostname.includes('-pooler') ||
    hostname !== RECOVERY_ENDPOINT_HOST ||
    hostname.startsWith(`${SOURCE_ENDPOINT_ID}.`)
  ) {
    throw new Error('Recovery test guard: unsafe recovery endpoint hostname');
  }

  for (const label of Object.keys(APPROVED_CONNECTIONS) as Array<
    keyof RecoveryConnectionUrls
  >) {
    validateConnectionUrl(label, connections[label], hostname);
  }

  return { branchId, endpointId, hostname, expiresAt };
}

export async function fetchRecoveryMetadata(input: {
  apiKey: string;
  branchId: string;
  fetchImplementation?: typeof fetch;
}): Promise<RecoveryMetadata> {
  const fetchImplementation = input.fetchImplementation ?? fetch;
  const baseUrl = `https://console.neon.tech/api/v2/projects/${RECOVERY_PROJECT_ID}/branches/${encodeURIComponent(input.branchId)}`;
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${input.apiKey}`,
  };
  const [branchResponse, endpointResponse] = await Promise.all([
    fetchImplementation(baseUrl, { headers, method: 'GET' }),
    fetchImplementation(`${baseUrl}/endpoints`, { headers, method: 'GET' }),
  ]);

  if (!branchResponse.ok || !endpointResponse.ok) {
    throw new Error('Recovery test guard: Neon metadata verification failed');
  }

  const branchBody = (await branchResponse.json()) as { branch?: NeonBranch };
  const endpointBody = (await endpointResponse.json()) as {
    endpoints?: NeonEndpoint[];
  };

  if (!branchBody.branch || !Array.isArray(endpointBody.endpoints)) {
    throw new Error('Recovery test guard: invalid Neon metadata response');
  }

  return { branch: branchBody.branch, endpoints: endpointBody.endpoints };
}
