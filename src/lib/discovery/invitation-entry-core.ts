export type DiscoveryInvitationEntryState =
  | 'established'
  | 'expired'
  | 'unavailable';

type Scheduler = {
  clear(handle: ReturnType<typeof setTimeout>): void;
  set(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
};

type ExchangeLifecycleOptions = {
  exchange(
    token: string,
    signal: AbortSignal,
  ): Promise<DiscoveryInvitationEntryState>;
  onResult(result: DiscoveryInvitationEntryState): void;
  scheduler?: Scheduler;
  token: string | null;
};

const defaultScheduler: Scheduler = {
  clear: (handle) => clearTimeout(handle),
  set: (callback, delay) => setTimeout(callback, delay),
};

export function consumeDiscoveryInvitationFragment(input: {
  hash: string;
  pathname: string;
  replaceState(url: string): void;
  search: string;
}): string | null {
  const token = new URLSearchParams(input.hash.slice(1)).get('token') || null;
  input.replaceState(`${input.pathname}${input.search}`);
  return token;
}

export function createDiscoveryInvitationExchangeLifecycle(
  options: ExchangeLifecycleOptions,
) {
  const scheduler = options.scheduler ?? defaultScheduler;
  const controller = new AbortController();
  let active = false;
  let abortHandle: ReturnType<typeof setTimeout> | null = null;
  let started = false;

  const report = (result: DiscoveryInvitationEntryState) => {
    if (active) options.onResult(result);
  };

  const start = () => {
    if (started) return;
    started = true;

    if (!options.token) {
      queueMicrotask(() => report('unavailable'));
      return;
    }

    void options.exchange(options.token, controller.signal)
      .then(report)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          report('unavailable');
        }
      });
  };

  return {
    setup() {
      active = true;
      if (abortHandle !== null) {
        scheduler.clear(abortHandle);
        abortHandle = null;
      }
      start();

      return () => {
        active = false;
        if (controller.signal.aborted || abortHandle !== null) return;
        // React Strict Mode immediately replays effects in development. Deferring
        // the abort lets that replay retain the one in-flight exchange, while a
        // genuine unmount still cancels the browser request on the next task.
        abortHandle = scheduler.set(() => {
          abortHandle = null;
          controller.abort();
        }, 0);
      };
    },
  };
}
