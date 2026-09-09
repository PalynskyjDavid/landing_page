import { connectionSimulation } from "./connectionSimulation.js";
import { buildApiUrl } from "./apiUrl.js";

const DEFAULT_BASE_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "/api" : "http://localhost:3001");
const DEFAULT_TIMEOUT_MS = 10000;

const clientHooks = {
  onRequest: null,
  onSuccess: null,
  onError: null,
};

class ApiClientError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ApiClientError";
    this.status = details.status ?? null;
    this.code = details.code ?? null;
    this.details = details.details ?? null;
    this.url = details.url ?? null;
    this.method = details.method ?? null;
    this.isRetryable = details.isRetryable ?? false;
    this.retryAfterMs = details.retryAfterMs ?? null;
  }
}

function buildUrl(path, params) {
  return buildApiUrl(DEFAULT_BASE_URL, path, params);
}

function mergeSignals(timeoutMs, signal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("Request timed out.")), timeoutMs);

  const abortFromExternalSignal = () => controller.abort(signal?.reason);

  if (signal) {
    if (signal.aborted) {
      abortFromExternalSignal();
    } else {
      signal.addEventListener("abort", abortFromExternalSignal, { once: true });
    }
  }

  return {
    signal: controller.signal,
    abort: (reason) => controller.abort(reason),
    cleanup() {
      clearTimeout(timeoutId);

      if (signal) {
        signal.removeEventListener("abort", abortFromExternalSignal);
      }
    },
  };
}

function isJsonResponse(response) {
  return response.headers.get("content-type")?.includes("application/json");
}

async function parseResponseBody(response) {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  if (isJsonResponse(response)) {
    return JSON.parse(text);
  }

  return text;
}

function normalizeError({ error, response, payload, url, method }) {
  if (error instanceof ApiClientError) {
    return error;
  }

  const status = response?.status ?? null;
  const details =
    payload && typeof payload === "object" ? payload : payload ? { message: payload } : null;
  const errorDetails =
    details?.error && typeof details.error === "object" ? details.error : details;
  const message =
    errorDetails?.message ||
    error?.message ||
    (status ? `Request failed with status ${status}.` : "Network request failed.");

  return new ApiClientError(message, {
    status,
    code: errorDetails?.code ?? null,
    details,
    url,
    method,
    retryAfterMs: parseRetryAfter(response?.headers.get("retry-after")),
    isRetryable:
      !status || status === 408 || status === 429 || status >= 500 || error?.name === "AbortError",
  });
}

export function parseRetryAfter(value, now = Date.now()) {
  if (!value?.trim()) return null;
  const raw = value.trim();
  if (/^\d+$/.test(raw)) {
    const milliseconds = Number(raw) * 1000;
    return Number.isSafeInteger(milliseconds) ? milliseconds : null;
  }
  // HTTP-date, not arbitrary date-like strings such as "-1".
  if (!/^[A-Za-z]{3}, /.test(raw)) return null;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : null;
}

export function isRetryableError(error) {
  return Boolean(error?.isRetryable);
}

export function setApiClientHooks(nextHooks = {}) {
  clientHooks.onRequest = nextHooks.onRequest ?? null;
  clientHooks.onSuccess = nextHooks.onSuccess ?? null;
  clientHooks.onError = nextHooks.onError ?? null;
}

export async function request({
  method = "GET",
  path,
  params,
  data,
  headers,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal,
} = {}) {
  const url = buildUrl(path, params);
  const requestMethod = method.toUpperCase();
  const body = data === undefined ? undefined : JSON.stringify(data);
  const { signal: mergedSignal, cleanup, abort } = mergeSignals(timeoutMs, signal);

  const simulateConnectionLoss = () => {
    if (connectionSimulation.getSnapshot().enabled) {
      abort(
        new ApiClientError("Connection loss simulation is active in this tab.", {
          code: "simulated_connection_loss",
          isRetryable: true,
          url,
          method: requestMethod,
        }),
      );
    }
  };
  const unsubscribeSimulation = connectionSimulation.subscribe(simulateConnectionLoss);

  clientHooks.onRequest?.({ method: requestMethod, url, params, data });

  try {
    simulateConnectionLoss();
    mergedSignal.throwIfAborted();
    const response = await fetch(url, {
      method: requestMethod,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      body,
      signal: mergedSignal,
    });

    const payload = await parseResponseBody(response);
    mergedSignal.throwIfAborted();

    if (!response.ok) {
      throw normalizeError({ response, payload, url, method: requestMethod });
    }

    clientHooks.onSuccess?.({
      method: requestMethod,
      url,
      status: response.status,
      data: payload,
    });

    return payload;
  } catch (error) {
    const failure =
      mergedSignal.reason?.code === "simulated_connection_loss" ? mergedSignal.reason : error;
    const normalizedError = normalizeError({ error: failure, url, method: requestMethod });
    clientHooks.onError?.({ method: requestMethod, url, error: normalizedError });
    throw normalizedError;
  } finally {
    unsubscribeSimulation();
    cleanup();
  }
}

export const apiClient = {
  request,
  setHooks: setApiClientHooks,
};
