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
