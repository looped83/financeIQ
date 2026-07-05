import type { KeyValueStore } from './kvStore';

const SESSION_KEY = 'financeiq.session.v1';

export interface PersistedFile {
  fileName: string;
  csv: string;
}

export interface PersistedSession {
  primary: PersistedFile | null;
  compare: PersistedFile | null;
}

export async function saveSession(kv: KeyValueStore, session: PersistedSession): Promise<void> {
  await kv.set(SESSION_KEY, JSON.stringify(session));
}

/** Returns null if nothing was ever saved, or if the stored value isn't valid JSON
 *  (e.g. a leftover value from an incompatible earlier schema version). */
export async function loadSession(kv: KeyValueStore): Promise<PersistedSession | null> {
  const raw = await kv.get(SESSION_KEY);
  if (raw === undefined) return null;
  try {
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

export async function clearSession(kv: KeyValueStore): Promise<void> {
  await kv.delete(SESSION_KEY);
}
