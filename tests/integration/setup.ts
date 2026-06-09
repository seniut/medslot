// Per-worker setup for integration tests. Truncates every table before each
// test so cases are fully isolated and order-independent. The Prisma client
// connects to the test database because the integration project injects
// DATABASE_URL/DIRECT_URL into the worker env (see vitest.config.ts).

import { afterAll, beforeEach } from "vitest";

import { prisma } from "@/db/prisma";

// Child-table-first ordering is not required because TRUNCATE ... CASCADE
// handles foreign keys, but listing every table keeps the reset explicit.
const TABLES = [
  "AuditLog",
  "ConsentRecord",
  "DoctorNote",
  "Appointment",
  "BlockedTime",
  "WorkingHour",
  "Patient",
  "AdminUser",
  "Doctor",
  "Clinic",
] as const;

export async function resetDatabase(): Promise<void> {
  const list = TABLES.map((table) => `"${table}"`).join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`,
  );
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
