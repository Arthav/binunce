const DB_NAME = "binunce_storage";
const STORE_NAME = "kv";
const VERSION = 1;

function openStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(STORE_NAME, mode);
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
      resolve(transaction.objectStore(STORE_NAME));
    };
  });
}

export async function getBytes(key: string): Promise<Uint8Array | null> {
  const store = await openStore("readonly");
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const value = request.result as Uint8Array | ArrayBuffer | null | undefined;
      if (!value) {
        resolve(null);
        return;
      }
      resolve(value instanceof Uint8Array ? value : new Uint8Array(value));
    };
  });
}

export async function setBytes(key: string, value: Uint8Array): Promise<void> {
  const store = await openStore("readwrite");
  return new Promise((resolve, reject) => {
    const request = store.put(value, key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function deleteKey(key: string): Promise<void> {
  const store = await openStore("readwrite");
  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
