import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDiscoverySaveStatusPresentation,
  type DiscoverySaveState,
} from '../../src/lib/discovery/save-status-presentation';

function harness(initialStatus: DiscoverySaveState = 'saved') {
  const callbacks = new Map<number, () => void>();
  const delays: number[] = [];
  const announcements: DiscoverySaveState[] = [];
  let clock = 0;
  let nextId = 1;
  const presentation = createDiscoverySaveStatusPresentation({
    initialStatus,
    now: () => clock,
    scheduler: {
      clear(handle) {
        callbacks.delete(handle as unknown as number);
      },
      set(callback, delay) {
        const id = nextId++;
        callbacks.set(id, callback);
        delays.push(delay);
        return id as unknown as ReturnType<typeof setTimeout>;
      },
    },
  });
  presentation.subscribe((status) => announcements.push(status));

  return {
    advance(milliseconds: number) {
      clock += milliseconds;
    },
    announcements,
    callbacks,
    delays,
    presentation,
    runTimer() {
      const entry = callbacks.entries().next().value as
        | [number, () => void]
        | undefined;
      assert.ok(entry);
      callbacks.delete(entry[0]);
      entry[1]();
    },
  };
}

test('saving remains visible for one second after acknowledgement', () => {
  const test = harness();
  test.presentation.setStatus('unsaved');
  test.presentation.setStatus('saving');
  test.advance(250);
  test.presentation.setStatus('saved');

  assert.equal(test.presentation.getStatus(), 'saving');
  assert.equal(test.delays.at(-1), 1_250);
  test.advance(1_250);
  test.runTimer();
  assert.equal(test.presentation.getStatus(), 'saved');
  assert.deepEqual(test.announcements, ['unsaved', 'saving', 'saved']);
});

test('priority states replace saving immediately and cancel delayed saved status', () => {
  for (const priority of [
    'unsaved',
    'conflict',
    'offline',
    'unavailable',
    'error',
  ] as const) {
    const test = harness();
    test.presentation.setStatus('saving');
    test.presentation.setStatus('saved');
    assert.equal(test.callbacks.size, 1);
    test.presentation.setStatus(priority);
    assert.equal(test.presentation.getStatus(), priority);
    assert.equal(test.callbacks.size, 0);
  }
});

test('overlapping saves receive a fresh minimum duration and dispose cancels work', () => {
  const test = harness();
  test.presentation.setStatus('saving');
  test.advance(900);
  test.presentation.setStatus('saved');
  assert.equal(test.delays.at(-1), 600);

  test.presentation.setStatus('saving');
  test.advance(100);
  test.presentation.setStatus('saved');
  assert.equal(test.delays.at(-1), 1_400);
  assert.equal(test.callbacks.size, 1);

  test.presentation.dispose();
  assert.equal(test.callbacks.size, 0);
  assert.doesNotThrow(() => test.presentation.setStatus('error'));
});

test('Strict Mode cleanup and replay retain presentation timers', () => {
  const test = harness();
  const firstCleanup = test.presentation.setup();
  firstCleanup();
  assert.equal(test.callbacks.size, 1);

  const replayCleanup = test.presentation.setup();
  assert.equal(test.callbacks.size, 0);
  test.presentation.setStatus('saving');
  test.presentation.setStatus('saved');
  assert.equal(test.callbacks.size, 1);

  replayCleanup();
  assert.equal(test.callbacks.size, 2);
});

test('saved never appears without a persistence acknowledgement', () => {
  const test = harness('unsaved');
  test.presentation.setStatus('saving');
  test.advance(1_000);
  assert.equal(test.presentation.getStatus(), 'saving');
  assert.equal(test.announcements.includes('saved'), false);
});
