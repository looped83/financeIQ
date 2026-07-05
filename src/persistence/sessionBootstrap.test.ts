import { describe, expect, it } from 'vitest';
import { createMemoryStore } from './kvStore';
import { clearPersistedSession, persistCompareFile, persistPrimaryFile, restoreSession } from './sessionBootstrap';
import { createAppStore } from '../state/appStore';
import { loadSession } from './sessionPersistence';

const HEADER = 'date,type,amount,tax,name,category';
const PRIMARY_CSV = [HEADER, '2024-01-05,TRANSFER_INBOUND,3000,0,Employer,'].join('\n');
const COMPARE_CSV = [HEADER, '2024-02-05,TRANSFER_INBOUND,2500,0,Employer,'].join('\n');

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

  it('restores both primary and compare files when both were persisted', async () => {
    const kv = createMemoryStore();
    await persistPrimaryFile(kv, 'jan-2024.csv', PRIMARY_CSV);
    await persistCompareFile(kv, 'jan-2023.csv', COMPARE_CSV);
    const { store, actions } = createAppStore();
    await restoreSession(kv, actions);
    expect(store.getState().compare.fileName).toBe('jan-2023.csv');
    expect(store.getState().compare.analysis?.totalInc).toBe(2500);
  });
});

describe('persistPrimaryFile / persistCompareFile', () => {
  it('persisting a compare file does not clobber an already-persisted primary file', async () => {
    const kv = createMemoryStore();
    await persistPrimaryFile(kv, 'jan-2024.csv', PRIMARY_CSV);
    await persistCompareFile(kv, 'jan-2023.csv', COMPARE_CSV);
    const session = await loadSession(kv);
    expect(session?.primary?.fileName).toBe('jan-2024.csv');
    expect(session?.compare?.fileName).toBe('jan-2023.csv');
  });

  it('persisting a new primary file does not clobber an already-persisted compare file', async () => {
    const kv = createMemoryStore();
    await persistCompareFile(kv, 'jan-2023.csv', COMPARE_CSV);
    await persistPrimaryFile(kv, 'jan-2024.csv', PRIMARY_CSV);
    const session = await loadSession(kv);
    expect(session?.primary?.fileName).toBe('jan-2024.csv');
    expect(session?.compare?.fileName).toBe('jan-2023.csv');
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
