// Resolve the database URL used by the integration test suite.
//
// Integration tests run against a DEDICATED database so they never touch
// development or production data. Resolution order:
//   1. TEST_DATABASE_URL (explicit, e.g. in CI);
//   2. DATABASE_URL from the process env or the local `.env`, with the database
//      name suffixed `_test` (e.g. `medslot` -> `medslot_test`).
//
// `prisma migrate deploy` creates the test database automatically on first run.

import { readFileSync } from "node:fs";
import { Socket } from "node:net";
import { resolve } from "node:path";

function readEnvValue(key: string): string | undefined {
  if (process.env[key]) {
    return process.env[key];
  }
  try {
    const content = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    const match = content.match(
      new RegExp(`^${key}\\s*=\\s*"?([^"\\n]+?)"?\\s*$`, "m"),
    );
    return match?.[1];
  } catch {
    return undefined;
  }
}

export function resolveTestDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL;
  if (explicit) {
    return explicit;
  }

  const base = readEnvValue("DATABASE_URL");
  if (!base) {
    throw new Error(
      "Integration tests need a database URL. Set TEST_DATABASE_URL, or " +
        "DATABASE_URL (in the environment or .env) so a `_test` database can " +
        "be derived from it.",
    );
  }

  const url = new URL(base);
  const dbName = url.pathname.replace(/^\//, "") || "medslot";
  if (!dbName.endsWith("_test")) {
    url.pathname = `/${dbName}_test`;
  }
  return url.toString();
}

/**
 * Probe whether the database server is accepting TCP connections, so the
 * integration suite can be skipped gracefully when Postgres is not running
 * (e.g. a commit on a machine without Docker up) instead of failing with a
 * connection error. Only the host/port are checked — no query is run.
 */
export function isDatabaseReachable(
  databaseUrl: string,
  timeoutMs = 1500,
): Promise<boolean> {
  return new Promise((resolveReachable) => {
    let host = "localhost";
    let port = 5432;
    try {
      const url = new URL(databaseUrl);
      host = url.hostname || host;
      port = url.port ? Number(url.port) : port;
    } catch {
      resolveReachable(false);
      return;
    }

    const socket = new Socket();
    let settled = false;
    const finish = (reachable: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolveReachable(reachable);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

