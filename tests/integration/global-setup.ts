// Vitest global setup for integration tests. Runs ONCE before the suite.
//
// 1. Probe whether the test database is reachable. If it is not (e.g. Postgres
//    is not running), publish `integrationDbAvailable = false` so every
//    integration suite is skipped instead of failing — a commit that runs the
//    full suite still succeeds. In CI this is a hard error instead, so a
//    missing database can never make the pipeline pass silently.
// 2. When reachable, apply all Prisma migrations to the dedicated test database
//    (creating it on first run, including the btree_gist no-overlap exclusion
//    constraint) and publish `integrationDbAvailable = true`.
//
// The same URL is used for the runtime connection and migrations because the
// local test database is a single, unpooled Postgres.

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import type { GlobalSetupContext } from "vitest/node";

import { isDatabaseReachable, resolveTestDatabaseUrl } from "./test-db-url";

export default async function setup({ provide }: GlobalSetupContext) {
  const url = resolveTestDatabaseUrl();
  const host = new URL(url).host;

  if (!(await isDatabaseReachable(url))) {
    if (process.env.CI) {
      throw new Error(
        `Integration test database is not reachable at ${host}. ` +
          "Start Postgres (docker compose up -d) or set TEST_DATABASE_URL.",
      );
    }
    console.warn(
      `\n[integration] Test database not reachable at ${host}; skipping ` +
        "integration tests. Start it with `docker compose up -d` to run them.\n",
    );
    provide("integrationDbAvailable", false);
    return;
  }

  const prismaBin = resolve(process.cwd(), "node_modules/.bin/prisma");
  execFileSync(prismaBin, ["migrate", "deploy"], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: url,
      DIRECT_URL: url,
    },
  });

  provide("integrationDbAvailable", true);
}

