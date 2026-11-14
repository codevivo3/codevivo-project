import { spawnSync } from 'node:child_process';

export const DISCOVERY_KEYCHAIN_ACCOUNT = 'codevivo-project';
export const DISCOVERY_ADMIN_URL_SERVICE =
  'codevivo.discovery.admin.database-url';
export const DISCOVERY_RUNTIME_URL_SERVICE =
  'codevivo.discovery.runtime.database-url';
export const DISCOVERY_PEPPER_SERVICE = 'codevivo.discovery.token-pepper';

export type KeychainFailureCategory =
  | 'timeout'
  | 'access-denied'
  | 'lookup-failed'
  | 'empty-secret';

interface KeychainCommandResult {
  error?: NodeJS.ErrnoException;
  status: number | null;
  stdout: string | null;
  stderr: string | null;
}

interface KeychainCommandOptions {
  encoding: 'utf8';
  stdio: ['ignore', 'pipe', 'pipe'];
  timeout: number;
}

type KeychainCommandRunner = (
  command: string,
  args: string[],
  options: KeychainCommandOptions,
) => KeychainCommandResult;

interface KeychainDependencies {
  platform?: NodeJS.Platform;
  runCommand?: KeychainCommandRunner;
}

export class DiscoveryKeychainError extends Error {
  constructor(
    public readonly category: KeychainFailureCategory,
    service: string,
  ) {
    super(`Project Discovery Keychain ${category}: ${service}`);
    this.name = 'DiscoveryKeychainError';
  }
}

const ACCESS_DENIED_PATTERN =
  /(?:access|authorization|permission) denied|interaction (?:is )?not allowed|errSec(?:AuthFailed|InteractionNotAllowed)/iu;

const runKeychainCommand: KeychainCommandRunner = (command, args, options) =>
  spawnSync(command, args, options);

export function readKeychainSecret(
  service: string,
  dependencies: KeychainDependencies = {},
): string {
  const platform = dependencies.platform ?? process.platform;
  if (platform !== 'darwin') {
    throw new Error('Project Discovery administration requires macOS Keychain');
  }

  const result = (dependencies.runCommand ?? runKeychainCommand)(
    '/usr/bin/security',
    [
      'find-generic-password',
      '-a',
      DISCOVERY_KEYCHAIN_ACCOUNT,
      '-s',
      service,
      '-w',
    ],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    },
  );

  if (result.error) {
    const category =
      result.error.code === 'ETIMEDOUT'
        ? 'timeout'
        : result.error.code === 'EACCES' || result.error.code === 'EPERM'
          ? 'access-denied'
          : 'lookup-failed';
    throw new DiscoveryKeychainError(category, service);
  }

  if (result.status !== 0) {
    const category = ACCESS_DENIED_PATTERN.test(result.stderr ?? '')
      ? 'access-denied'
      : 'lookup-failed';
    throw new DiscoveryKeychainError(category, service);
  }

  const secret = (result.stdout ?? '').trim();
  if (!secret) {
    throw new DiscoveryKeychainError('empty-secret', service);
  }

  return secret;
}
