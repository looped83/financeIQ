import { describe, expect, it, vi } from 'vitest';
import { createStore } from './store';

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
