import type { Listener, Store, Unsubscribe } from '../state/store';

export interface GatedStore<T> {
  /** Hand this to a page: its subscribers only hear about changes while the gate is open. */
  store: Store<T>;
  /** Closing defers notifications; opening again replays the latest state once if anything changed. */
  setOpen(open: boolean): void;
  dispose(): void;
}

/**
 * Wraps a store so a hidden page does no work: no re-render and — more
 * expensive — no Chart.js teardown/rebuild while the user looks elsewhere.
 * Rendering into a hidden container would also give Chart.js a zero size.
 */
export function createGatedStore<T>(inner: Store<T>): GatedStore<T> {
  const listeners = new Set<Listener<T>>();
  let open = true;
  let stale = false;
  const notify = (state: T) => listeners.forEach((l) => l(state));

  const unsubscribeInner = inner.subscribe((state) => {
    if (open) notify(state);
    else stale = true;
  });

  return {
    store: {
      getState: inner.getState,
      setState: inner.setState,
      subscribe(listener): Unsubscribe {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    setOpen(next) {
      open = next;
      if (open && stale) {
        stale = false;
        notify(inner.getState());
      }
    },
    dispose() {
      unsubscribeInner();
      listeners.clear();
    },
  };
}
