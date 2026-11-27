import { timingSafeEqual } from 'node:crypto';

export const DISCOVERY_VALIDATION_ADMIN_HOST =
  'ep-late-sea-bas88ozp.c-8.eu-central-1.aws.neon.tech';
export const DISCOVERY_VALIDATION_DATABASE = 'neondb';
export const DISCOVERY_VALIDATION_ADMIN_ROLE = 'codevivo_discovery_admin';
export const DISCOVERY_VALIDATION_ORIGIN =
  'https://codevivo-project-git-discovery-validation-codevivo-team.vercel.app';

export type DiscoveryAdministrationEnvironment = 'production' | 'validation';

export type DiscoveryAdministrationTarget = {
  database: string;
  environment: DiscoveryAdministrationEnvironment;
  host: string;
  origin: string;
  role: 'codevivo_discovery_admin';
};

const DATABASE_TARGET_ERROR =
  'The administration credential does not target the approved Discovery validation database';
const ORIGIN_ERROR =
  'DISCOVERY_BASE_URL must be the approved Discovery validation Preview origin';

const TARGET_CONFIGURATION_ERROR =
  'The selected Discovery administration environment is not safely configured';

export function getDiscoveryAdministrationTarget(
  environment: DiscoveryAdministrationEnvironment,
  configuration: Record<string, string | undefined> = process.env,
): DiscoveryAdministrationTarget {
  if (environment === 'validation') {
    return {
      database: DISCOVERY_VALIDATION_DATABASE,
      environment,
      host: DISCOVERY_VALIDATION_ADMIN_HOST,
      origin: DISCOVERY_VALIDATION_ORIGIN,
      role: DISCOVERY_VALIDATION_ADMIN_ROLE,
    };
  }

  const host = configuration.DISCOVERY_PRODUCTION_ADMIN_HOST;
  const database = configuration.DISCOVERY_PRODUCTION_DATABASE;
  const origin = configuration.DISCOVERY_PRODUCTION_ORIGIN;
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin ?? '');
  } catch {
    throw new Error(TARGET_CONFIGURATION_ERROR);
  }
  if (
    !host
    || !/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/u.test(host)
    || host.includes('-pooler.')
    || host === DISCOVERY_VALIDATION_ADMIN_HOST
    || !database
    || !/^[a-zA-Z_][a-zA-Z0-9_]*$/u.test(database)
    || parsedOrigin.origin !== 'https://codevivo.dev'
    || parsedOrigin.pathname !== '/'
    || parsedOrigin.search
    || parsedOrigin.hash
    || parsedOrigin.username
    || parsedOrigin.password
  ) {
    throw new Error(TARGET_CONFIGURATION_ERROR);
  }
  return {
    database,
    environment,
    host,
    origin: parsedOrigin.origin,
    role: 'codevivo_discovery_admin',
  };
}

export function parseDiscoveryAdministrationInvocation(argv: string[]): {
  command: string;
  environment: DiscoveryAdministrationEnvironment;
} {
  const [environmentFlag, environment, command, ...extra] = argv;
  if (
    environmentFlag !== '--environment'
    || (environment !== 'validation' && environment !== 'production')
    || !command
    || extra.length > 0
  ) {
    throw new Error(
      'Usage: npm run discovery:admin -- --environment <validation|production> <create|inspect|retrieve|revoke|extend>',
    );
  }
  return { command, environment };
}

export function validateDiscoveryAdministrationDatabaseUrl(
  connectionString: string,
  target: DiscoveryAdministrationTarget,
): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('The administration credential does not match the selected environment');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== target.host
    || url.hostname.includes('-pooler.')
    || decodeURIComponent(url.pathname.slice(1)) !== target.database
    || decodeURIComponent(url.username) !== target.role
    || !url.password
  ) {
    throw new Error('The administration credential does not match the selected environment');
  }
  return connectionString;
}

export function requireDiscoveryAdministrationOrigin(
  value: string | undefined,
  target: DiscoveryAdministrationTarget,
): URL {
  let url: URL;
  try {
    url = new URL(value ?? '');
  } catch {
    throw new Error('DISCOVERY_BASE_URL does not match the selected environment');
  }
  if (
    url.origin !== target.origin
    || url.pathname !== '/'
    || url.search
    || url.hash
    || url.username
    || url.password
  ) {
    throw new Error('DISCOVERY_BASE_URL does not match the selected environment');
  }
  return new URL(target.origin);
}

export async function verifyDiscoveryAdministrationIdentity(
  query: (strings: TemplateStringsArray) => Promise<Array<Record<string, unknown>>>,
  target: DiscoveryAdministrationTarget,
): Promise<void> {
  const [identity] = await query`
    SELECT current_database() AS database, current_user AS role
  `;
  if (identity?.database !== target.database || identity?.role !== target.role) {
    throw new Error('The connected database identity does not match the selected environment');
  }
}

export function connectDiscoveryAdministrationDatabase<Database>(
  connectionString: string,
  target: DiscoveryAdministrationTarget,
  connect: (validatedConnectionString: string) => Database,
): Database {
  return connect(validateDiscoveryAdministrationDatabaseUrl(
    connectionString,
    target,
  ));
}

export function prepareDiscoveryAdministrationInvitation<Database>(input: {
  baseUrl: string | undefined;
  connectionString: string;
  connect(validatedConnectionString: string): Database;
  target: DiscoveryAdministrationTarget;
}): { baseUrl: URL; database: Database } {
  const baseUrl = requireDiscoveryAdministrationOrigin(input.baseUrl, input.target);
  const database = connectDiscoveryAdministrationDatabase(
    input.connectionString,
    input.target,
    input.connect,
  );
  return { baseUrl, database };
}

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
