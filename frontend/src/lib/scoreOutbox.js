const DATABASE_NAME = "landing-page-reliability";
const DATABASE_VERSION = 1;
const STORE_NAME = "score-submissions";

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function openDatabase(databaseFactory) {
  if (!databaseFactory) {
    return Promise.reject(new Error("IndexedDB is unavailable in this browser."));
  }

  return new Promise((resolve, reject) => {
    const request = databaseFactory.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (database.objectStoreNames.contains(STORE_NAME)) {
        return;
      }

      const store = database.createObjectStore(STORE_NAME, { keyPath: "submissionId" });
      store.createIndex("status", "status", { unique: false });
      store.createIndex("createdAt", "createdAt", { unique: false });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB upgrade is blocked by another tab."));
  });
}

function sortOldestFirst(entries) {
  return entries.sort((left, right) => {
    const createdComparison = left.createdAt.localeCompare(right.createdAt);
    return createdComparison || left.submissionId.localeCompare(right.submissionId);
  });
}

export function createScoreOutbox(databaseFactory = globalThis.indexedDB) {
  let databasePromise;

  function getDatabase() {
    databasePromise ??= openDatabase(databaseFactory);
    return databasePromise;
  }

  async function withStore(mode, operation) {
    const database = await getDatabase();
    const transaction = database.transaction(STORE_NAME, mode);
    const result = await operation(transaction.objectStore(STORE_NAME));
    await transactionComplete(transaction);
    return result;
  }

  async function update(submissionId, patch) {
    return withStore("readwrite", async (store) => {
      const existing = await requestResult(store.get(submissionId));
      if (!existing) {
        return null;
      }

      const updated = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      await requestResult(store.put(updated));
      return updated;
    });
  }

  return {
    async put(submission) {
      return withStore("readwrite", async (store) => {
        const existing = await requestResult(store.get(submission.submissionId));
        const now = new Date().toISOString();
        const record = {
          ...submission,
          status: "pending",
          attemptCount: existing?.attemptCount ?? 0,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          lastError: null,
        };

        await requestResult(store.put(record));
        return record;
      });
    },

    async listPending() {
      return withStore("readonly", async (store) => {
        const entries = await requestResult(store.index("status").getAll("pending"));
        return sortOldestFirst(entries);
      });
    },

    markPending(submissionId, details) {
      return update(submissionId, { ...details, status: "pending" });
    },

    markFailed(submissionId, details) {
      return update(submissionId, { ...details, status: "failed" });
    },

    async remove(submissionId) {
      return withStore("readwrite", async (store) => {
        await requestResult(store.delete(submissionId));
      });
    },
  };
}

export const scoreOutbox = createScoreOutbox();
