import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DiscoveryKeychainError,
  readKeychainSecret,
} from '../../scripts/discovery-keychain';

const SERVICE = 'codevivo.discovery.test-item';
const SENSITIVE_MARKER = 'SENSITIVE_TEST_MARKER';

type MockResult = {
  error?: NodeJS.ErrnoException;
  status: number | null;
  stdout: string | null;
  stderr: string | null;
};

function readWithResult(result: MockResult) {
  let receivedCommand = '';
  let receivedArgs: string[] = [];
  let receivedTimeout = 0;

  const secret = readKeychainSecret(SERVICE, {
    platform: 'darwin',
    runCommand(command, args, options) {
      receivedCommand = command;
      receivedArgs = args;
      receivedTimeout = options.timeout;
      return result;
    },
  });

  return { secret, receivedCommand, receivedArgs, receivedTimeout };
}

function assertFailure(
  result: MockResult,
  expectedCategory: DiscoveryKeychainError['category'],
) {
  assert.throws(
    () =>
      readKeychainSecret(SERVICE, {
        platform: 'darwin',
        runCommand: () => result,
      }),
    (error: unknown) => {
      assert.ok(error instanceof DiscoveryKeychainError);
      assert.equal(error.category, expectedCategory);
      assert.match(error.message, new RegExp(expectedCategory, 'u'));
      assert.doesNotMatch(error.message, new RegExp(SENSITIVE_MARKER, 'u'));
      return true;
    },
  );
}

test('retrieves and trims a Keychain secret with a bounded 60-second timeout', () => {
  const result = readWithResult({
    status: 0,
    stdout: `  ${SENSITIVE_MARKER}\n`,
    stderr: '',
  });

  assert.equal(result.secret, SENSITIVE_MARKER);
  assert.equal(result.receivedCommand, '/usr/bin/security');
  assert.deepEqual(result.receivedArgs, [
    'find-generic-password',
    '-a',
    'codevivo-project',
    '-s',
    SERVICE,
    '-w',
  ]);
  assert.equal(result.receivedTimeout, 60_000);
});

test('classifies a subprocess timeout without leaking subprocess output', () => {
  assertFailure(
    {
      error: Object.assign(new Error(SENSITIVE_MARKER), { code: 'ETIMEDOUT' }),
      status: null,
      stdout: SENSITIVE_MARKER,
      stderr: SENSITIVE_MARKER,
    },
    'timeout',
  );
});

test('classifies denied Keychain access without leaking stderr', () => {
  assertFailure(
    {
      status: 1,
      stdout: SENSITIVE_MARKER,
      stderr: `User interaction is not allowed. ${SENSITIVE_MARKER}`,
    },
    'access-denied',
  );
});

test('classifies an unsuccessful Keychain lookup without leaking output', () => {
  assertFailure(
    {
      status: 44,
      stdout: SENSITIVE_MARKER,
      stderr: `The specified item could not be found. ${SENSITIVE_MARKER}`,
    },
    'lookup-failed',
  );
});

test('classifies successful empty output as an empty secret', () => {
  assertFailure(
    {
      status: 0,
      stdout: '  \n',
      stderr: SENSITIVE_MARKER,
    },
    'empty-secret',
  );
});
