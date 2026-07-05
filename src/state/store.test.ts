import { describe, expect, it, vi } from 'vitest';
import { createStore, subscribeSelected } from './store';

describe('createStore', () => {
  it('returns the initial state from getState()', () => {
    const store = createStore({ count: 0 });
    expect(store.getState()).toEqual({ count: 0 });
  });

  it('setState accepts a plain value', () => {
    const store = createStore({ count: 0 });
    store.setState({ count: 5 });
    expect(store.getState()).toEqual({ count: 5 });
  });

  it('setState accepts an updater function receiving the previous state', () => {
    const store = createStore({ count: 5 });
    store.setState((prev) => ({ count: prev.count + 1 }));
    expect(store.getState()).toEqual({ count: 6 });
  });

  it('notifies subscribers with the new state on every setState call', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener);

    store.setState({ count: 1 });
    store.setState({ count: 2 });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, { count: 1 });
    expect(listener).toHaveBeenNthCalledWith(2, { count: 2 });
  });

  it('supports multiple independent subscribers', () => {
    const store = createStore({ count: 0 });
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe(a);
    store.subscribe(b);

    store.setState({ count: 1 });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops further notifications for that listener only', () => {
    const store = createStore({ count: 0 });
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = store.subscribe(a);
    store.subscribe(b);

    unsubA();
    store.setState({ count: 1 });

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('each createStore() call is an independent instance (no shared module state)', () => {
    const s1 = createStore({ count: 0 });
    const s2 = createStore({ count: 0 });
    s1.setState({ count: 99 });
    expect(s2.getState()).toEqual({ count: 0 });
  });
});

describe('subscribeSelected', () => {
  it('runs the listener once immediately with the current state', () => {
    const store = createStore({ a: 1, b: 1 });
    const listener = vi.fn();
    subscribeSelected(store, (s) => [s.a], listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ a: 1, b: 1 });
  });

  it('skips changes that leave the selected dependencies untouched', () => {
    const store = createStore({ a: 1, b: 1 });
    const listener = vi.fn();
    subscribeSelected(store, (s) => [s.a], listener);

    store.setState((s) => ({ ...s, b: 2 }));
    expect(listener).toHaveBeenCalledTimes(1); // only the initial run

    store.setState((s) => ({ ...s, a: 2 }));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('tracks multiple dependencies independently', () => {
    const store = createStore({ a: 1, b: 1, c: 1 });
    const listener = vi.fn();
    subscribeSelected(store, (s) => [s.a, s.b], listener);

    store.setState((s) => ({ ...s, c: 2 }));
    store.setState((s) => ({ ...s, b: 2 }));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('re-notifies a listener that dispatches synchronously during its initial run (DeepDive default-month pattern)', () => {
    const store = createStore({ selected: '', analysisVersion: 1 });
    const seen: string[] = [];
    subscribeSelected(store, (s) => [s.selected, s.analysisVersion], (s) => {
      seen.push(s.selected);
      if (!s.selected) store.setState((prev) => ({ ...prev, selected: '2024-05' }));
    });
    expect(seen).toEqual(['', '2024-05']);
  });

  it('returns an unsubscribe function that stops further runs', () => {
    const store = createStore({ a: 1 });
    const listener = vi.fn();
    const unsubscribe = subscribeSelected(store, (s) => [s.a], listener);
    unsubscribe();
    store.setState({ a: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
