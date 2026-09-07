import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vitest must not discover Playwright's browser scenarios.
  test: {
    include: ["src/**/*.test.{js,jsx}", "e2e/support/**/*.test.js"],
  },
  resolve: {
    preserveSymlinks: true,
  },
});
