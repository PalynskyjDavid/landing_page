const DEFAULT_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
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
  }
}

function buildUrl(path, params) {
  const url = new URL(path, DEFAULT_BASE_URL);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }

      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
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
    isRetryable:
      !status || status === 408 || status === 429 || status >= 500 || error?.name === "AbortError",
  });
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
  const { signal: mergedSignal, cleanup } = mergeSignals(timeoutMs, signal);

  clientHooks.onRequest?.({ method: requestMethod, url, params, data });

  try {
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
    const normalizedError = normalizeError({ error, url, method: requestMethod });
    clientHooks.onError?.({ method: requestMethod, url, error: normalizedError });
    throw normalizedError;
  } finally {
    cleanup();
  }
}

export const apiClient = {
  request,
  setHooks: setApiClientHooks,
};
