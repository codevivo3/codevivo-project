export type DiscoverySaveState =
  | 'conflict'
  | 'error'
  | 'initializing'
  | 'offline'
  | 'saved'
  | 'saving'
  | 'unavailable'
  | 'unsaved';

type Scheduler = {
  clear(handle: ReturnType<typeof setTimeout>): void;
  set(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
};

type PresentationOptions = {
  initialStatus: DiscoverySaveState;
  minimumSavingMs?: number;
  now?: () => number;
  scheduler?: Scheduler;
};

const defaultScheduler: Scheduler = {
  clear: (handle) => clearTimeout(handle),
  set: (callback, delay) => setTimeout(callback, delay),
};

export function createDiscoverySaveStatusPresentation(
  options: PresentationOptions,
) {
  const minimumSavingMs = options.minimumSavingMs ?? 1_500;
  const now = options.now ?? Date.now;
  const scheduler = options.scheduler ?? defaultScheduler;
  const listeners = new Set<(status: DiscoverySaveState) => void>();
  let sourceStatus = options.initialStatus;
  let visibleStatus = options.initialStatus;
  let savingStartedAt = sourceStatus === 'saving' ? now() : null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposalTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const clearTimer = () => {
    if (timer !== null) scheduler.clear(timer);
    timer = null;
  };

  const publish = (status: DiscoverySaveState) => {
    if (disposed || visibleStatus === status) return;
    visibleStatus = status;
    for (const listener of listeners) listener(status);
  };

  const dispose = () => {
    disposed = true;
    clearTimer();
    if (disposalTimer !== null) scheduler.clear(disposalTimer);
    disposalTimer = null;
    listeners.clear();
  };

  return {
    dispose,
    getStatus() {
      return visibleStatus;
    },
    setStatus(status: DiscoverySaveState) {
      if (disposed) return;
      const previousSourceStatus = sourceStatus;
      sourceStatus = status;
      clearTimer();

      if (status === 'saving') {
        if (previousSourceStatus !== 'saving') savingStartedAt = now();
        publish('saving');
        return;
      }

      if (status === 'saved' && savingStartedAt !== null) {
        const remaining = minimumSavingMs - (now() - savingStartedAt);
        if (remaining > 0) {
          timer = scheduler.set(() => {
            timer = null;
            if (sourceStatus !== 'saved') return;
            savingStartedAt = null;
            publish('saved');
          }, remaining);
          return;
        }
      }

      savingStartedAt = null;
      publish(status);
    },
    setup() {
      if (disposalTimer !== null) {
        scheduler.clear(disposalTimer);
        disposalTimer = null;
      }

      return () => {
        if (disposed || disposalTimer !== null) return;
        disposalTimer = scheduler.set(() => {
          disposalTimer = null;
          dispose();
        }, 0);
      };
    },
    subscribe(listener: (status: DiscoverySaveState) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
