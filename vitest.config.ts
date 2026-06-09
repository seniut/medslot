import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";

import { resolveTestDatabaseUrl } from "./tests/integration/test-db-url";

// Resolve the integration test database URL eagerly so it can be injected into
// the integration project's worker env. Unit tests do not need a database, so a
// failure here must not break them — the integration global setup re-resolves
// it and fails loudly when integration tests actually run.
let testDatabaseUrl = "";
try {
  testDatabaseUrl = resolveTestDatabaseUrl();
} catch {
  testDatabaseUrl = "";
}

const serverOnlyStub = fileURLToPath(
  new URL("./tests/stubs/server-only.ts", import.meta.url),
);

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // Server modules under test may `import "server-only"`; neutralize it.
      "server-only": serverOnlyStub,
    },
  },
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/app/**",
        "src/components/**",
        "src/i18n/**",
        "src/proxy.ts",
      ],
    },
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          // Integration tests share one database. Run every file in a single
          // worker process so the per-test TRUNCATE in setup.ts can never race
          // against another file's fixtures (which corrupts foreign keys).
          pool: "forks",
          poolOptions: {
            forks: { singleFork: true },
          },
          env: {
            DATABASE_URL: testDatabaseUrl,
            DIRECT_URL: testDatabaseUrl,
          },
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
