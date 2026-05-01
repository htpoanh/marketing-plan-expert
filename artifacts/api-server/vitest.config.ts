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
    // Use array form so we can control match order — most specific first.
    // `@workspace/db/schema` must match BEFORE `@workspace/db` or it gets
    // shadowed (Vite alias does plain prefix matching).
    alias: [
      {
        find: /^@workspace\/db\/schema$/,
        replacement: path.resolve(__dirname, "../../lib/db/src/schema/index.ts"),
      },
      {
        find: /^@workspace\/db$/,
        replacement: path.resolve(__dirname, "../../lib/db/src/index.ts"),
      },
      {
        find: /^@workspace\/integrations-anthropic-ai$/,
        replacement: path.resolve(
          __dirname,
          "../../lib/integrations-anthropic-ai/src/index.ts",
        ),
      },
      {
        find: /^@workspace\/integrations-gemini-ai$/,
        replacement: path.resolve(
          __dirname,
          "../../lib/integrations-gemini-ai/src/index.ts",
        ),
      },
    ],
  },
});
