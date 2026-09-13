import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { apiDocsPlugin } from "./scripts/apiDocsPlugin.js";
import { flowentoBudgetPlugin } from "./scripts/flowentoBudget.js";

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, import.meta.dirname, "VITE_");
  return {
    plugins: [
      react(),
      ...(command === "build" ? [flowentoBudgetPlugin()] : []),
      ...(command === "serve" ? [apiDocsPlugin(env.VITE_API_URL || "http://localhost:3001")] : []),
    ],
    // Only the development docs smoke server opts into a same-origin API proxy.
    server: env.VITE_API_PROXY_TARGET
      ? {
          proxy: {
            "/api": {
              target: env.VITE_API_PROXY_TARGET,
              rewrite: (path) => path.replace(/^\/api(?=\/|$)/, "") || "/",
            },
          },
        }
      : undefined,
    // Vitest must not discover Playwright's browser scenarios.
    test: {
      include: ["src/**/*.test.{js,jsx}", "e2e/support/**/*.test.js"],
    },
    resolve: {
      preserveSymlinks: true,
    },
  };
});
