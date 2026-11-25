export const PHASE2_PROJECT_ID = 'round-tree-42808727';
export const PHASE2_BRANCH_NAME = 'discovery-phase2-validation';
export const PHASE2_BRANCH_ID = 'br-dawn-glitter-bax62bzg';
export const PHASE2_PARENT_BRANCH_ID = 'br-winter-block-bagymuuk';
export const PHASE2_ENDPOINT_ID = 'ep-winter-firefly-baddzj6i';
export const PHASE2_DIRECT_HOST =
  'ep-winter-firefly-baddzj6i.c-8.eu-central-1.aws.neon.tech';
export const PHASE2_POOLED_HOST =
  'ep-winter-firefly-baddzj6i-pooler.c-8.eu-central-1.aws.neon.tech';
export const PHASE2_DATABASE = 'neondb';
export const PHASE2_AUTHORIZATION = 'discovery-phase2-validation';
export const PHASE2_MINIMUM_LIFETIME_MS = 2 * 60 * 60 * 1000;

export const PHASE2_KEYCHAIN_SERVICES = {
  apiKey: 'codevivo.discovery.recovery.neon-api-key',
  admin: 'codevivo.discovery.phase2.admin.database-url',
  migration: 'codevivo.discovery.phase2.migration.database-url',
  runtime: 'codevivo.discovery.phase2.runtime.database-url',
} as const;

const ROLES = {
  admin: 'codevivo_discovery_admin',
  migration: 'codevivo_discovery_migration',
  runtime: 'codevivo_discovery_runtime',
} as const;

type ConnectionKind = keyof typeof ROLES;

export type Phase2Connections = Record<ConnectionKind, string>;

type NeonBranch = {
  id?: string;
  name?: string;
  parent_id?: string;
  expires_at?: string;
};

type NeonEndpoint = {
  id?: string;
  branch_id?: string;
  host?: string;
  type?: string;
};

export type Phase2Metadata = {
  branches: NeonBranch[];
  endpoints: NeonEndpoint[];
};

export type VerifiedPhase2Target = {
  branchId: string;
  endpointId: string;
  expiresAt: string;
};

function validateConnection(kind: ConnectionKind, connectionString: string) {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(`Phase 2 validation guard: malformed ${kind} URL`);
  }
  const pooled = kind === 'runtime';
  const expectedHost = pooled ? PHASE2_POOLED_HOST : PHASE2_DIRECT_HOST;
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== expectedHost ||
    decodeURIComponent(url.pathname.slice(1)) !== PHASE2_DATABASE ||
    decodeURIComponent(url.username) !== ROLES[kind] ||
    url.hostname.includes('-pooler') !== pooled
  ) {
    throw new Error(`Phase 2 validation guard: unsafe ${kind} target`);
  }
}

export function verifyPhase2Target(input: {
  authorization?: string;
  connections: Phase2Connections;
  metadata: Phase2Metadata;
  now?: Date;
}): VerifiedPhase2Target {
  if (input.authorization !== PHASE2_AUTHORIZATION) {
    throw new Error('Phase 2 validation guard: explicit authorization is required');
  }
  const matches = input.metadata.branches.filter(
    (branch) => branch.name === PHASE2_BRANCH_NAME,
  );
  if (matches.length !== 1) {
    throw new Error('Phase 2 validation guard: branch identity is ambiguous');
  }
  const branch = matches[0];
  if (
    branch.id !== PHASE2_BRANCH_ID ||
    branch.parent_id !== PHASE2_PARENT_BRANCH_ID
  ) {
    throw new Error('Phase 2 validation guard: branch identity mismatch');
  }
  if (!branch.expires_at) {
    throw new Error('Phase 2 validation guard: branch expiration is unavailable');
  }
  const expiresAt = Date.parse(branch.expires_at);
  const now = (input.now ?? new Date()).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt - now < PHASE2_MINIMUM_LIFETIME_MS) {
    throw new Error('Phase 2 validation guard: insufficient branch lifetime');
  }
  const endpoints = input.metadata.endpoints.filter(
    (endpoint) =>
      endpoint.branch_id === branch.id &&
      endpoint.type === 'read_write' &&
      endpoint.host === PHASE2_DIRECT_HOST,
  );
  if (endpoints.length !== 1 || endpoints[0].id !== PHASE2_ENDPOINT_ID) {
    throw new Error('Phase 2 validation guard: endpoint identity mismatch');
  }
  for (const kind of Object.keys(ROLES) as ConnectionKind[]) {
    validateConnection(kind, input.connections[kind]);
  }
  return {
    branchId: branch.id,
    endpointId: endpoints[0].id,
    expiresAt: branch.expires_at,
  };
}

export async function fetchPhase2Metadata(input: {
  apiKey: string;
  fetchImplementation?: typeof fetch;
}): Promise<Phase2Metadata> {
  const fetchImplementation = input.fetchImplementation ?? fetch;
  const base = `https://console.neon.tech/api/v2/projects/${PHASE2_PROJECT_ID}`;
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${input.apiKey}`,
  };
  const branchesResponse = await fetchImplementation(`${base}/branches?limit=100`, {
    headers,
    method: 'GET',
  });
  if (!branchesResponse.ok) {
    throw new Error('Phase 2 validation guard: Neon branch lookup failed');
  }
  const branchBody = (await branchesResponse.json()) as { branches?: NeonBranch[] };
  if (!Array.isArray(branchBody.branches)) {
    throw new Error('Phase 2 validation guard: invalid branch metadata');
  }
  const matches = branchBody.branches.filter(
    (branch) => branch.name === PHASE2_BRANCH_NAME,
  );
  if (matches.length !== 1 || !matches[0].id) {
    throw new Error('Phase 2 validation guard: branch identity is ambiguous');
  }
  const endpointResponse = await fetchImplementation(
    `${base}/branches/${encodeURIComponent(matches[0].id)}/endpoints`,
    { headers, method: 'GET' },
  );
  if (!endpointResponse.ok) {
    throw new Error('Phase 2 validation guard: Neon endpoint lookup failed');
  }
  const endpointBody = (await endpointResponse.json()) as { endpoints?: NeonEndpoint[] };
  if (!Array.isArray(endpointBody.endpoints)) {
    throw new Error('Phase 2 validation guard: invalid endpoint metadata');
  }
  return { branches: branchBody.branches, endpoints: endpointBody.endpoints };
}
