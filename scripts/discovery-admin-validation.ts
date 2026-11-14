import { timingSafeEqual } from 'node:crypto';

export const DISCOVERY_VALIDATION_ADMIN_HOST =
  'ep-late-sea-bas88ozp.c-8.eu-central-1.aws.neon.tech';
export const DISCOVERY_VALIDATION_DATABASE = 'neondb';
export const DISCOVERY_VALIDATION_ADMIN_ROLE = 'codevivo_discovery_admin';
export const DISCOVERY_VALIDATION_ORIGIN =
  'https://codevivo-project-git-discovery-validation-codevivo-team.vercel.app';

const DATABASE_TARGET_ERROR =
  'The administration credential does not target the approved Discovery validation database';
const ORIGIN_ERROR =
  'DISCOVERY_BASE_URL must be the approved Discovery validation Preview origin';

export function validateDiscoveryValidationDatabaseUrl(
  connectionString: string,
): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(DATABASE_TARGET_ERROR);
  }

  const role = decodeURIComponent(url.username);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (
    (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') ||
    url.hostname !== DISCOVERY_VALIDATION_ADMIN_HOST ||
    database !== DISCOVERY_VALIDATION_DATABASE ||
    role !== DISCOVERY_VALIDATION_ADMIN_ROLE
  ) {
    throw new Error(DATABASE_TARGET_ERROR);
  }

  return connectionString;
}

export function requireDiscoveryValidationOrigin(value: string | undefined): URL {
  if (!value) throw new Error(ORIGIN_ERROR);

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(ORIGIN_ERROR);
  }

  if (
    url.origin !== DISCOVERY_VALIDATION_ORIGIN ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(ORIGIN_ERROR);
  }

  return new URL(DISCOVERY_VALIDATION_ORIGIN);
}

export function connectDiscoveryValidationDatabase<Database>(
  connectionString: string,
  connect: (validatedConnectionString: string) => Database,
): Database {
  return connect(validateDiscoveryValidationDatabaseUrl(connectionString));
}

export function prepareDiscoveryValidationInvitation<Database>(input: {
  baseUrl: string | undefined;
  connectionString: string;
  connect(validatedConnectionString: string): Database;
}): { baseUrl: URL; database: Database } {
  const baseUrl = requireDiscoveryValidationOrigin(input.baseUrl);
  const database = connectDiscoveryValidationDatabase(
    input.connectionString,
    input.connect,
  );
  return { baseUrl, database };
}

export function discoveryTokenPeppersMatch(
  localPepper: string,
  deployedPepper: string,
): boolean {
  const local = Buffer.from(localPepper, 'utf8');
  const deployed = Buffer.from(deployedPepper, 'utf8');
  return local.length === deployed.length && timingSafeEqual(local, deployed);
}
