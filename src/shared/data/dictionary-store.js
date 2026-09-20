const DB_NAME = 'alantil-local-data';
const DB_VERSION = 1;
const STORE_NAME = 'dictionary';
const SNAPSHOT_KEY = 'current';
export const DICTIONARY_STORE_SCHEMA_VERSION = 1;

let databasePromise = null;

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve) => {
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return databasePromise;
}

function requestResult(request) {
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => resolve(null);
  });
}

export async function readDictionarySnapshot() {
  const database = await openDatabase();
  if (!database) return null;
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const record = await requestResult(transaction.objectStore(STORE_NAME).get(SNAPSHOT_KEY));
    if (!record || record.schema_version !== DICTIONARY_STORE_SCHEMA_VERSION) return null;
    if (!String(record.version || '').trim() || !Array.isArray(record.words) || !record.words.length) return null;
    if (Number(record.word_count || 0) !== record.words.length) return null;
    return {
      version: String(record.version).trim(),
      words: record.words,
      source: 'indexeddb',
      savedAt: String(record.saved_at || ''),
    };
  } catch {
    return null;
  }
}

export async function writeDictionarySnapshot(snapshot) {
  const version = String(snapshot?.version || '').trim();
  const words = Array.isArray(snapshot?.words) ? snapshot.words : [];
  if (!version || !words.length) return false;
  const database = await openDatabase();
  if (!database) return false;
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
      transaction.objectStore(STORE_NAME).put({
        key: SNAPSHOT_KEY,
        schema_version: DICTIONARY_STORE_SCHEMA_VERSION,
        version,
        word_count: words.length,
        saved_at: new Date().toISOString(),
        words,
      });
    } catch {
      resolve(false);
    }
  });
}

export async function clearDictionarySnapshot() {
  const database = await openDatabase();
  if (!database) return false;
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
      transaction.objectStore(STORE_NAME).delete(SNAPSHOT_KEY);
    } catch {
      resolve(false);
    }
  });
}
