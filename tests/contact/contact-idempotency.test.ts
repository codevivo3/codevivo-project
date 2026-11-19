import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyContactIdempotencyRotation,
  getOrCreateContactIdempotencyKey,
  rotateContactIdempotencyKey,
} from '../../src/lib/contact/idempotency';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

test('reuses a stable contact submission key until explicit rotation', () => {
  const storage = memoryStorage();
  const firstKey = '10000000-0000-4000-8000-000000000001';
  const secondKey = '20000000-0000-4000-8000-000000000002';
  let creations = 0;
  const create = () => {
    creations += 1;
    return creations === 1 ? firstKey : secondKey;
  };

  assert.equal(getOrCreateContactIdempotencyKey(storage, create), firstKey);
  assert.equal(getOrCreateContactIdempotencyKey(storage, create), firstKey);
  assert.equal(creations, 1);
  assert.equal(rotateContactIdempotencyKey(storage, create), secondKey);
  assert.equal(getOrCreateContactIdempotencyKey(storage, create), secondKey);
  assert.equal(creations, 2);
});

test('invalid stored values are replaced and invalid generated keys fail closed', () => {
  const storage = memoryStorage();
  storage.setItem('codevivo.contact.idempotency-key.v1', 'not-a-uuid');
  const validKey = '30000000-0000-4000-8000-000000000003';

  assert.equal(
    getOrCreateContactIdempotencyKey(storage, () => validKey),
    validKey,
  );
  assert.throws(
    () => rotateContactIdempotencyKey(storage, () => 'invalid'),
    /Unable to create a contact submission key/u,
  );
});

test('confirmed success rotates storage and the hidden input when the rotation flag is absent', () => {
  const storage = memoryStorage();
  const previousKey = '40000000-0000-4000-8000-000000000004';
  const nextKey = '50000000-0000-4000-8000-000000000005';
  const input = { value: previousKey };

  storage.setItem('codevivo.contact.idempotency-key.v1', previousKey);

  assert.equal(
    applyContactIdempotencyRotation(
      { success: true },
      storage,
      input,
      () => nextKey,
    ),
    nextKey,
  );
  assert.equal(input.value, nextKey);
  assert.equal(getOrCreateContactIdempotencyKey(storage), nextKey);
});
