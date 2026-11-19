const CONTACT_IDEMPOTENCY_STORAGE_KEY =
  'codevivo.contact.idempotency-key.v1';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type ContactIdempotencyStorage = Pick<Storage, 'getItem' | 'setItem'>;

interface ContactIdempotencyRotationState {
  rotateIdempotencyKey?: boolean;
  success: boolean;
}

interface ContactIdempotencyInput {
  value: string;
}

export function isContactIdempotencyKey(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value);
}

function createValidatedKey(createKey: () => string): string {
  const key = createKey().toLowerCase();
  if (!isContactIdempotencyKey(key)) {
    throw new Error('Unable to create a contact submission key');
  }
  return key;
}

export function getOrCreateContactIdempotencyKey(
  storage: ContactIdempotencyStorage,
  createKey: () => string = () => crypto.randomUUID(),
): string {
  try {
    const existing = storage.getItem(CONTACT_IDEMPOTENCY_STORAGE_KEY);
    if (isContactIdempotencyKey(existing)) return existing.toLowerCase();
  } catch {
    // Storage can be unavailable in privacy-restricted browsing contexts.
  }

  return rotateContactIdempotencyKey(storage, createKey);
}

export function rotateContactIdempotencyKey(
  storage: ContactIdempotencyStorage,
  createKey: () => string = () => crypto.randomUUID(),
): string {
  const key = createValidatedKey(createKey);
  try {
    storage.setItem(CONTACT_IDEMPOTENCY_STORAGE_KEY, key);
  } catch {
    // The caller retains the key in memory when persistent storage is blocked.
  }
  return key;
}

export function applyContactIdempotencyRotation(
  state: ContactIdempotencyRotationState,
  storage: ContactIdempotencyStorage,
  input: ContactIdempotencyInput | null,
  createKey: () => string = () => crypto.randomUUID(),
): string | null {
  if ((!state.success && !state.rotateIdempotencyKey) || !input) return null;

  const key = rotateContactIdempotencyKey(storage, createKey);
  input.value = key;
  return key;
}
