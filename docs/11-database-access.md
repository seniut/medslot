# 11 — Database access and example queries

How to connect **directly** to the PostgreSQL database — locally and in
production — and run read-only inspection queries. For schema design see
`docs/03-data-model.md`; for migrations and deploy see
`docs/07-runbook-dev-deploy.md`.

## Safety first (read this)

Patient data is **personal data** (GDPR/RODO). Treat every database connection as
production-sensitive.

- Prefer **read-only `SELECT`s**. Do **not** run manual `UPDATE`/`DELETE` against
  patient or appointment data — use the application. The app enforces audit
  logging, soft-delete/anonymization, consent capture, and the no-overlap
  booking rule; raw SQL writes bypass all of that and can corrupt history.
- **Never physically delete appointments.** Cancellation is a status change
  (`cancelled_by_patient` / `cancelled_by_doctor`), never a `DELETE`.
- Use the **direct** (unpooled) connection — `DIRECT_URL` — for interactive
  `psql`, Prisma Studio, and migrations. The pooled `DATABASE_URL` (Neon's
  `-pooler` host) is for the serverless app runtime.
- Never paste production connection strings into commits, screenshots, or chats.
- Close interactive sessions when done — Neon's free tier has a small connection
  limit.

## Identifier quoting (important)

The Prisma models are **not** mapped to snake_case, so PostgreSQL table and column
names are the exact PascalCase / camelCase identifiers. They are case-sensitive
and **must be double-quoted** in raw SQL:

```sql
SELECT "startsAt", "status" FROM "Appointment";   -- correct
SELECT startsat, status   FROM appointment;        -- ERROR: relation "appointment" does not exist
```

Enum values are lowercase strings: `'booked'`, `'completed'`,
`'cancelled_by_patient'`, `'cancelled_by_doctor'`, `'no_show'` for
`AppointmentStatus`; `'public_booking'`, `'manual_admin'` for `AppointmentSource`.

## Tools

- **Prisma Studio** — a browser GUI to view/edit rows. Easiest for browsing.
- **`psql`** — the PostgreSQL CLI, best for ad-hoc queries.
- **Neon SQL Editor** — run SQL in the Neon dashboard with no local setup (the
  recommended way to inspect production).
- **VS Code extensions** — browse and query the database without leaving the
  editor (see below).

## VS Code extensions

Install from the Extensions view (search the extension ID):

- **Prisma** (`Prisma.prisma`) — official extension for `schema.prisma`: syntax
  highlighting, formatting, and autocompletion. Install this for schema work even
  if you query the data elsewhere.
- **PostgreSQL** (`ms-ossdata.vscode-pgsql`, by Microsoft) — connect to a
  PostgreSQL server, browse schemas/tables in the sidebar, and run SQL from a
  query editor with a results grid.
- **SQLTools** (`mtxr.sqltools`) + **SQLTools PostgreSQL/Redshift Driver**
  (`mtxr.sqltools-driver-pg`) — a lightweight alternative: save named
  connections, run `.sql` files, and view results in a grid.

### Connecting (SQLTools example)

Command Palette → **SQLTools: Add New Connection** → **PostgreSQL**, then:

- **Local**: server `localhost`, port `5432`, database `medslot`, username
  `postgres`, password `postgres`, SSL **disabled**.
- **Neon (production)**: use the **direct** host (no `-pooler`), port `5432`, the
  database name from the connection string, the Neon username/password, and SSL
  **enabled** (`sslmode=require`). This is **live patient data** — keep the
  read-only mindset from "Safety first".

The identifier-quoting rule and the example queries below apply unchanged: type
`SELECT "startsAt" FROM "Appointment";`, not `appointment`.

---

## Local database

Start the local PostgreSQL (see `docker-compose.yml`):

```bash
docker compose up -d
```

The local credentials match `.env` / `.env.example`: user `postgres`, password
`postgres`, host `localhost`, port `5432`, database `medslot`. The integration
tests use a separate `medslot_test` database (created automatically).

### Prisma Studio (GUI)

```bash
pnpm prisma studio          # or: pnpm prisma:studio
```

Opens `http://localhost:5555` and connects via `DIRECT_URL`.

### psql inside the Docker container

```bash
docker compose exec postgres psql -U postgres -d medslot
```

### psql from the host (or any client)

```bash
psql "postgresql://postgres:postgres@localhost:5432/medslot"
# the test database:
psql "postgresql://postgres:postgres@localhost:5432/medslot_test"
```

### Run a .sql file through Prisma

```bash
pnpm prisma db execute --file ./scripts/query.sql --schema prisma/schema.prisma
```

---

## Production database (Neon)

Vercel hosts the **application**, not the database — there is no separate "Vercel
database" in this project. "Connecting after deploy" means connecting to the
**Neon** project whose connection strings you set as `DATABASE_URL` (pooled) and
`DIRECT_URL` (direct) in Vercel → Project → Settings → Environment Variables. You
can read those exact values there or in the Neon dashboard.

### Option A — Neon SQL Editor (recommended)

1. Open the Neon dashboard → your project → **SQL Editor**.
2. Pick the database/branch and run SQL. No local setup, nothing to leak.

### Option B — psql with the direct connection string

Use the **direct** string (host **without** `-pooler`, keep `?sslmode=require`):

```bash
psql "postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
```

### Option C — Prisma Studio against production (use with care)

This is **live patient data** — keep a read-only mindset.

```bash
DATABASE_URL="<neon-direct>" DIRECT_URL="<neon-direct>" pnpm prisma studio
```

### Check applied migrations

```bash
DATABASE_URL="<neon-pooled>" DIRECT_URL="<neon-direct>" pnpm prisma migrate status
```

---

## Example queries

All examples are read-only. Timestamps (`startsAt`, `endsAt`, `createdAt`, …) are
stored as **UTC instants**; convert to clinic-local time with `AT TIME ZONE` when
you need wall-clock values.

```sql
-- Convert a UTC instant to clinic-local time
SELECT "startsAt" AT TIME ZONE 'Europe/Warsaw' AS local_start
FROM "Appointment"
ORDER BY "startsAt" DESC
LIMIT 10;
```

```sql
-- Today's appointments with patient contact (admin-only data)
SELECT a."startsAt" AT TIME ZONE 'Europe/Warsaw' AS local_start,
       a.status, a.source,
       p."firstName", p."lastName", p.phone
FROM "Appointment" a
JOIN "Patient" p ON p.id = a."patientId"
WHERE a."startsAt" >= date_trunc('day', now())
  AND a."startsAt" <  date_trunc('day', now()) + interval '1 day'
ORDER BY a."startsAt";
```

```sql
-- Upcoming booked appointments
SELECT "startsAt", "endsAt", status
FROM "Appointment"
WHERE status = 'booked' AND "startsAt" > now()
ORDER BY "startsAt"
LIMIT 50;
```

```sql
-- Appointment counts by status
SELECT status, count(*) AS total
FROM "Appointment"
GROUP BY status
ORDER BY total DESC;
```

```sql
-- No-shows in the last 30 days
SELECT a."startsAt" AT TIME ZONE 'Europe/Warsaw' AS local_start,
       p."firstName", p."lastName"
FROM "Appointment" a
JOIN "Patient" p ON p.id = a."patientId"
WHERE a.status = 'no_show'
  AND a."startsAt" >= now() - interval '30 days'
ORDER BY a."startsAt" DESC;
```

```sql
-- Find a patient by email (case-insensitive). Anonymized patients have redacted
-- name/contact fields and a non-null "anonymizedAt".
SELECT id, "firstName", "lastName", phone, email, "anonymizedAt"
FROM "Patient"
WHERE lower(email) = lower('patient@example.com');
```

```sql
-- Weekly working hours for the doctor (0 = Sunday … 6 = Saturday)
SELECT "dayOfWeek", "startTime", "endTime", "isActive"
FROM "WorkingHour"
ORDER BY "dayOfWeek";
```

```sql
-- Upcoming blocked time
SELECT "startsAt", "endsAt", reason
FROM "BlockedTime"
WHERE "endsAt" > now()
ORDER BY "startsAt";
```

```sql
-- Recent audit trail. Metadata holds only counts/flags, never patient data.
SELECT "createdAt", action, "entityType", "entityId", "actorUserId", metadata
FROM "AuditLog"
ORDER BY "createdAt" DESC
LIMIT 50;
```

```sql
-- Confirm the double-booking guard exists (GiST exclusion constraint)
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'appointment_no_overlap';
```

```sql
-- Applied Prisma migrations
SELECT migration_name, finished_at
FROM "_prisma_migrations"
ORDER BY finished_at;
```

```sql
-- Approximate row counts per table
SELECT relname AS table_name, n_live_tup AS approx_rows
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

## If you must change data

Prefer the application UI/flows, which keep audit logs, consent, soft-delete, and
the no-overlap rule consistent:

- Cancel a visit → admin appointment page (status change, never `DELETE`).
- Erase/anonymize a patient → admin patient page "anonymize" flow, or
  `pnpm retention:sweep` (see `docs/04-gdpr-rodo.md`).
- Change working hours / blocked time → admin settings page.

Only reach for manual SQL or Prisma Studio for genuine data repair, and record
why (these manual edits are **not** captured by the audit log).
