import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    setupFiles: [path.resolve(__dirname, "./src/__tests__/setup.ts")],
    // Block live network in tests by default — anything that hits external
    // APIs must mock them.
    pool: "forks",
  },
  resolve: {
    alias: {
      "@workspace/db": path.resolve(__dirname, "../../lib/db/src/index.ts"),
      "@workspace/db/schema": path.resolve(__dirname, "../../lib/db/src/schema/index.ts"),
    },
  },
});
