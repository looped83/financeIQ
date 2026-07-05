export type Listener<T> = (state: T) => void;
export type Unsubscribe = () => void;
export type Updater<T> = T | ((prev: T) => T);

export interface Store<T> {
  getState(): T;
  setState(updater: Updater<T>): void;
  subscribe(listener: Listener<T>): Unsubscribe;
}

/**
 * Minimal framework-agnostic reactive store: get/set state, subscribe to
 * every change. No selectors, no middleware, no external dependency —
 * intentionally small, since Phase 3 is where UI components decide how
 * they want to consume it (direct subscribe, a thin selector helper, etc.).
 */
/**
 * Subscribes `listener` to `store`, invoking it once immediately and then only
 * when one of the dependencies returned by `select` changes (reference
 * equality — state updates are immutable, so unchanged slices keep their
 * identity). This is what lets a mounted tab skip re-rendering (and, more
 * expensively, destroying + recreating its Chart.js instances) when a state
 * change only concerns another tab.
 *
 * The subscription is registered BEFORE the initial run: a listener may
 * synchronously dispatch an action during its first render (DeepDiveView's
 * default-month selection does), and must be re-notified of the resulting
 * state change.
 */
export function subscribeSelected<T>(
  store: Store<T>,
  select: (state: T) => unknown[],
  listener: (state: T) => void,
): Unsubscribe {
  let last: unknown[] | null = null;
  const maybeRun = (state: T) => {
    const deps = select(state);
    if (last && deps.length === last.length && deps.every((d, i) => d === last![i])) return;
    last = deps;
    listener(state);
  };
  const unsubscribe = store.subscribe(maybeRun);
  maybeRun(store.getState());
  return unsubscribe;
}

export function createStore<T>(initialState: T): Store<T> {
  let state = initialState;
  const listeners = new Set<Listener<T>>();

  return {
    getState: () => state,
    setState(updater) {
      state = typeof updater === 'function' ? (updater as (prev: T) => T)(state) : updater;
      for (const listener of listeners) listener(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
