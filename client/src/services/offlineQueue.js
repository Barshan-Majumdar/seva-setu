const DB_NAME = 'sevasetu-offline-db';
const STORE_NAME = 'need-submissions';
const DB_VERSION = 1;

const openDb = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withStore = async (mode, operation) => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);

    operation(store, resolve, reject);

    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
};

export const queueNeedSubmission = async (payload) => {
  const queuedAt = new Date().toISOString();
  return withStore('readwrite', (store, resolve, reject) => {
    const request = store.add({ payload, queuedAt });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getQueuedNeedSubmissions = async () =>
  withStore('readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });

export const clearQueuedNeedSubmission = async (id) =>
  withStore('readwrite', (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
