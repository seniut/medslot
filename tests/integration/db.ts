// Shared `describe` wrapper for integration suites.
//
// `integrationDbAvailable` is published by the integration global setup
// (tests/integration/global-setup.ts): it is `true` when the test database is
// reachable and `false` otherwise. Using `describeDb` instead of `describe`
// makes every integration suite skip automatically when Postgres is not
// running, so the full test suite (and the pre-commit hook that runs it) still
// passes on a machine without the database up — while running for real the
// moment the database is reachable.

import { describe, inject } from "vitest";

declare module "vitest" {
  interface ProvidedContext {
    integrationDbAvailable: boolean;
  }
}

export const dbAvailable = inject("integrationDbAvailable") ?? false;

export const describeDb = describe.skipIf(!dbAvailable);
