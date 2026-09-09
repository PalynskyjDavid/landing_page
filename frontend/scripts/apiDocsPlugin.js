import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { parse } from "yaml";

const require = createRequire(import.meta.url);
const contractFile = new URL("../../docs/contracts/openapi.yaml", import.meta.url);

// A development-only Vite middleware, not a public backend endpoint or production bundle.
export function apiDocsPlugin(apiURL) {
  const sameOrigin = apiURL.startsWith("/") && !apiURL.startsWith("//");
  const target = new URL(apiURL, sameOrigin ? "http://docs.invalid" : undefined);
  if (
    !["http:", "https:"].includes(target.protocol) ||
    target.username ||
    target.password ||
    target.search ||
    target.hash ||
    apiURL.includes("\\")
  ) {
    throw new Error("API docs require an HTTP(S) API URL without embedded credentials.");
  }
  const serverURL = sameOrigin
    ? target.pathname.replace(/\/$/, "")
    : target.href.replace(/\/$/, "");
  const assets = new Map([
    ["/docs", ["text/html", new URL("../docs/index.html", import.meta.url)]],
    ["/docs/", ["text/html", new URL("../docs/index.html", import.meta.url)]],
    [
      "/docs/initializer.js",
      ["text/javascript", new URL("../docs/initializer.js", import.meta.url)],
    ],
    ["/docs/docs.css", ["text/css", new URL("../docs/docs.css", import.meta.url)]],
    ["/docs/swagger-ui.css", ["text/css", require.resolve("swagger-ui-dist/swagger-ui.css")]],
    [
      "/docs/swagger-ui-bundle.js",
      ["text/javascript", require.resolve("swagger-ui-dist/swagger-ui-bundle.js")],
    ],
  ]);

  return {
    name: "local-api-docs",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split("?")[0];
        const isContract = pathname === "/docs/openapi.json";
        const asset = assets.get(pathname);
        if (!asset && !isContract) return next();
        if (!["GET", "HEAD"].includes(request.method)) {
          response.writeHead(405, { Allow: "GET, HEAD" });
          response.end();
          return;
        }

        async function serve() {
          let content;
          if (isContract) {
            const document = parse(await readFile(contractFile, "utf8"));
            // Only the served copy changes. The checked-in contract stays environment-neutral.
            content = JSON.stringify({ ...document, servers: [{ url: serverURL }] });
          } else {
            content = await readFile(asset[1]);
          }
          response.setHeader(
            "Content-Type",
            `${isContract ? "application/json" : asset[0]}; charset=utf-8`,
          );
          response.setHeader("Cache-Control", "no-store");
          response.setHeader("X-Content-Type-Options", "nosniff");
          response.setHeader(
            "Content-Security-Policy",
            `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ${sameOrigin ? "" : target.origin}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
          );
          response.end(request.method === "HEAD" ? undefined : content);
        }
        void serve().catch(next);
      });
    },
  };
}
