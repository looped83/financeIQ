import { parseCSV } from '../domain/csv';
import { analyze } from '../domain/analyze';
import type { AppActions } from '../state/appStore';
import type { KeyValueStore } from './kvStore';
import { clearSession, loadSession, saveSession } from './sessionPersistence';

/** Re-hydrates the store from a previously persisted session, if any. Returns whether a
 *  primary file was restored (there is nothing to restore without one, even if a stale
 *  compare file was saved). */
export async function restoreSession(kv: KeyValueStore, actions: AppActions): Promise<boolean> {
  const session = await loadSession(kv);
  if (!session?.primary) return false;
  actions.loadFile(analyze(parseCSV(session.primary.csv)), session.primary.fileName);
  if (session.compare) actions.loadCompareFile(analyze(parseCSV(session.compare.csv)), session.compare.fileName);
  return true;
}

/** Persists the primary file's raw CSV text, preserving any already-persisted compare file. */
export async function persistPrimaryFile(kv: KeyValueStore, fileName: string, csv: string): Promise<void> {
  const existing = await loadSession(kv);
  await saveSession(kv, { primary: { fileName, csv }, compare: existing?.compare ?? null });
}

/** Persists the compare file's raw CSV text, preserving the already-persisted primary file. */
export async function persistCompareFile(kv: KeyValueStore, fileName: string, csv: string): Promise<void> {
  const existing = await loadSession(kv);
  await saveSession(kv, { primary: existing?.primary ?? null, compare: { fileName, csv } });
}

export async function clearPersistedSession(kv: KeyValueStore): Promise<void> {
  await clearSession(kv);
}
