import { parseCSV } from '../domain/csv';
import { analyze } from '../domain/analyze';
import type { AppActions } from '../state/appStore';
import type { KeyValueStore } from './kvStore';
import { clearSession, loadSession, saveSession } from './sessionPersistence';

/** Re-hydrates the store from a previously persisted session, if any. Returns whether a file was restored. */
export async function restoreSession(kv: KeyValueStore, actions: AppActions): Promise<boolean> {
  const session = await loadSession(kv);
  if (!session?.primary) return false;
  actions.loadFile(analyze(parseCSV(session.primary.csv)), session.primary.fileName);
  return true;
}

/** Persists the loaded file's raw CSV text. */
export async function persistPrimaryFile(kv: KeyValueStore, fileName: string, csv: string): Promise<void> {
  await saveSession(kv, { primary: { fileName, csv } });
}

export async function clearPersistedSession(kv: KeyValueStore): Promise<void> {
  await clearSession(kv);
}
