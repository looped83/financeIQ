import { describe, expect, it } from 'vitest';
import { createMemoryStore } from './kvStore';
import { clearSession, loadSession, saveSession, type PersistedSession } from './sessionPersistence';

describe('sessionPersistence', () => {
  it('returns null when nothing has been saved yet', async () => {
    const kv = createMemoryStore();
    expect(await loadSession(kv)).toBeNull();
  });

  it('round-trips a saved session', async () => {
    const kv = createMemoryStore();
    const session: PersistedSession = {
      primary: { fileName: 'jan.csv', csv: 'date,type,amount\n2024-01-01,BUY,-100' },
    };
    await saveSession(kv, session);
    expect(await loadSession(kv)).toEqual(session);
  });

  it('overwrites a previously saved session', async () => {
    const kv = createMemoryStore();
    await saveSession(kv, { primary: { fileName: 'old.csv', csv: 'x' }});
    await saveSession(kv, { primary: { fileName: 'new.csv', csv: 'y' }});
    expect(await loadSession(kv)).toEqual({ primary: { fileName: 'new.csv', csv: 'y' }});
  });

  it('returns null instead of throwing on corrupt stored data', async () => {
    const kv = createMemoryStore();
    await kv.set('financeiq.session.v1', 'not valid json{{{');
    expect(await loadSession(kv)).toBeNull();
  });

  it('clears a saved session', async () => {
    const kv = createMemoryStore();
    await saveSession(kv, { primary: { fileName: 'jan.csv', csv: 'a' }});
    await clearSession(kv);
    expect(await loadSession(kv)).toBeNull();
  });
});
