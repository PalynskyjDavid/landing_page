// Kept separate from the game's retry/outbox client: never replay destructive commands.
export function containerLabEnabled(doc = globalThis.document) {
  return doc?.querySelector('meta[name="reliability-lab"]')?.content === "isolated";
}

export async function labRequest(command, { fetchImpl = globalThis.fetch, signal } = {}) {
  const response = await fetchImpl(command ? "/lab-api/commands" : "/lab-api/status", {
    method: command ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: command ? { "Content-Type": "application/json" } : undefined,
    body: command ? JSON.stringify(command) : undefined,
    signal,
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error("Lab request rejected");
    error.code = data.code;
    throw error;
  }
  if (data.kind !== "isolated-reliability-lab") throw new Error("Not a lab controller");
  return data;
}

export async function labHealthRequest({ fetchImpl = globalThis.fetch, signal } = {}) {
  const response = await fetchImpl("/lab-api/health", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  const data = await response.json();
  if (!response.ok || data.kind !== "isolated-reliability-lab" || !Array.isArray(data.samples)) {
    throw new Error("Lab health history unavailable");
  }
  return data;
}
