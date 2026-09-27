import { describe, expect, it } from 'vitest';
import { createStore } from '../state/store';
import { createGatedStore } from './gatedStore';

describe('createGatedStore', () => {
  it('passes changes through while open', () => {
    const inner = createStore(0);
    const gate = createGatedStore(inner);
    const seen: number[] = [];
    gate.store.subscribe((s) => seen.push(s));
    inner.setState(1);
    expect(seen).toEqual([1]);
  });

  it('defers while closed and replays only the latest state once on reopen', () => {
    const inner = createStore(0);
    const gate = createGatedStore(inner);
    const seen: number[] = [];
    gate.store.subscribe((s) => seen.push(s));

    gate.setOpen(false);
    inner.setState(1);
    inner.setState(2);
    expect(seen).toEqual([]);

    gate.setOpen(true);
    expect(seen).toEqual([2]);
    gate.setOpen(true); // nothing new → no replay
    expect(seen).toEqual([2]);
  });

  it('stops listening after dispose', () => {
    const inner = createStore(0);
    const gate = createGatedStore(inner);
    const seen: number[] = [];
    gate.store.subscribe((s) => seen.push(s));
    gate.dispose();
    inner.setState(5);
    expect(seen).toEqual([]);
  });
});
