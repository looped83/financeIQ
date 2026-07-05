import type { KeyValueStore } from './kvStore';

const DB_NAME = 'financeiq';
const DB_VERSION = 1;
const OBJECT_STORE = 'kv';

function openDb(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(OBJECT_STORE)) req.result.createObjectStore(OBJECT_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Real IndexedDB-backed KeyValueStore. Browser-only (no Node fallback) — verified via
 *  Playwright against the built preview, not unit-tested (see kvStore.ts for the
 *  in-memory implementation used by sessionPersistence.test.ts). */
export function createIndexedDbStore(dbName = DB_NAME): KeyValueStore {
  const dbPromise = openDb(dbName);

  return {
    async get(key) {
      const db = await dbPromise;
      const tx = db.transaction(OBJECT_STORE, 'readonly');
      return request(tx.objectStore(OBJECT_STORE).get(key)) as Promise<string | undefined>;
    },
    async set(key, value) {
      const db = await dbPromise;
      const tx = db.transaction(OBJECT_STORE, 'readwrite');
      await request(tx.objectStore(OBJECT_STORE).put(value, key));
    },
    async delete(key) {
      const db = await dbPromise;
      const tx = db.transaction(OBJECT_STORE, 'readwrite');
      await request(tx.objectStore(OBJECT_STORE).delete(key));
    },
  };
}
