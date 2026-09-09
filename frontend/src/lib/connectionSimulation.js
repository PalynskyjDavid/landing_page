const STORAGE_KEY = "reactionGame.simulateConnectionLoss";

// sessionStorage keeps the switch through refreshes without broadcasting it to
// other tabs. Storage access can be denied, so the switch also works in memory.
export function createConnectionSimulation(getStorage = () => globalThis.sessionStorage) {
  const listeners = new Set();
  let snapshot = { enabled: false, persistent: true };

  try {
    const storage = getStorage();
    snapshot = { enabled: storage?.getItem(STORAGE_KEY) === "true", persistent: !!storage };
  } catch {
    snapshot = { enabled: false, persistent: false };
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setEnabled(enabled) {
      if (snapshot.enabled === enabled) return;
      let persistent = true;
      try {
        const storage = getStorage();
        if (!storage) throw new Error("Session storage is unavailable.");
        if (enabled) storage.setItem(STORAGE_KEY, "true");
        else storage.removeItem(STORAGE_KEY);
      } catch {
        persistent = false;
      }
      snapshot = { enabled, persistent };
      listeners.forEach((listener) => listener());
    },
  };
}

export const connectionSimulation = createConnectionSimulation();
