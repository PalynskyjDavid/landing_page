// Keep an API prefix when endpoint paths start with '/'. new URL('/scores', base)
// alone would discard '/api', while a root-relative base needs the browser origin.
export function buildApiUrl(base, path, params, origin = globalThis.location?.origin) {
  const target = new URL(base, origin);
  if (
    !["http:", "https:"].includes(target.protocol) ||
    target.username ||
    target.password ||
    target.search ||
    target.hash
  ) {
    throw new Error(
      "API base must be an HTTP(S) URL or same-origin path, without credentials/query/fragment.",
    );
  }
  target.pathname = `${target.pathname.replace(/\/+$/, "")}/`;
  const url = new URL(path.replace(/^\//, ""), target);
  if (url.origin !== target.origin || !url.pathname.startsWith(target.pathname)) {
    throw new Error("Endpoint must stay within the configured API base.");
  }
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== "")
      url.searchParams.set(key, String(value));
  }
  return url.toString();
}
