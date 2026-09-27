import { describe, expect, it } from 'vitest';
import { createMemoryStore } from './kvStore';
import { clearPersistedSession, persistPrimaryFile, restoreSession } from './sessionBootstrap';
import { createAppStore } from '../state/appStore';

const HEADER = 'date,type,amount,tax,name,category';
const PRIMARY_CSV = [HEADER, '2024-01-05,TRANSFER_INBOUND,3000,0,Employer,'].join('\n');

describe('restoreSession', () => {
  it('returns false and leaves the store untouched when nothing was ever persisted', async () => {
    const kv = createMemoryStore();
    const { store, actions } = createAppStore();
    const restored = await restoreSession(kv, actions);
    expect(restored).toBe(false);
    expect(store.getState().analysis).toBeNull();
  });

  it('restores a persisted primary file into the store', async () => {
    const kv = createMemoryStore();
    await persistPrimaryFile(kv, 'jan.csv', PRIMARY_CSV);
    const { store, actions } = createAppStore();
    const restored = await restoreSession(kv, actions);
    expect(restored).toBe(true);
    expect(store.getState().fileName).toBe('jan.csv');
    expect(store.getState().analysis?.totalInc).toBe(3000);
  });
});

describe('clearPersistedSession', () => {
  it('removes the persisted session so a later restore finds nothing', async () => {
    const kv = createMemoryStore();
    await persistPrimaryFile(kv, 'jan.csv', PRIMARY_CSV);
    await clearPersistedSession(kv);
    const { actions } = createAppStore();
    expect(await restoreSession(kv, actions)).toBe(false);
  });
});
