# Product and Architecture Decisions

This file stores decisions that define how the product is built.

## Decision 001 — Build a focused booking calendar, not a full marketplace

Status: Accepted

We are building a focused appointment calendar for healthcare professionals, not a ZnanyLekarz clone.

Reason:

- The core customer pain is booking and calendar management.
- Marketplace features such as reviews, SEO ranking, ads, and doctor discovery are out of MVP scope.
- A narrow MVP is easier to build, sell, support, and validate.

## Decision 002 — Patients do not need accounts in MVP

Status: Accepted

Patients book and cancel using forms and secure cancellation links.

Reason:

- Lower friction.
- Simpler implementation.
- Less support.
- Fewer password/auth issues.

## Decision 003 — PostgreSQL is the source of truth

Status: Accepted

All appointments, patients, working hours, notes, and audit logs live in PostgreSQL.

Reason:

- Appointment data is relational.
- PostgreSQL supports transactions and exclusion constraints.
- Double-booking protection must be enforced at the database level.

## Decision 004 — Cancelled appointments are not deleted

Status: Accepted

Cancelled appointments remain in the database with a cancellation status.

Reason:

- Doctor needs history.
- Auditability matters.
- Export and reporting should include cancellations if requested.

## Decision 005 — Notes are internal notes, not full medical documentation in MVP

Status: Accepted

The MVP notes field is for internal administrative notes only.

Reason:

- Full medical documentation has stronger legal and technical requirements.
- MVP should avoid becoming a medical records system accidentally.
- UI must warn admins not to use this field as full medical documentation.

## Decision 006 — Support Polish and English from the start

Status: Accepted

The UI must support `pl` and `en` locales.

Reason:

- Poland is the first target market.
- English makes the product more reusable and sellable outside Poland.
- i18n is easier to add early than retrofit later.

## Decision 007 — Pin Prisma to the v6 line for MVP

Status: Accepted

MedSlot uses Prisma 6.x, not Prisma 7.

Reason:

- Prisma 7 removed the `url` property from the `datasource` block and requires a `prisma.config.ts` file plus a driver adapter (or Accelerate URL) passed to the `PrismaClient` constructor.
- The handbook data model (`docs/03-data-model.md`) and dev runbook (`docs/07-runbook-dev-deploy.md`) assume the classic `datasource { url = env("DATABASE_URL") }` schema and the `prisma migrate dev` workflow.
- Staying on Prisma 6 keeps the documented migration/connection workflow intact for the MVP.
- Migrating to Prisma 7's driver-adapter model can be evaluated post-MVP via a dedicated ADR.

## Decision 008 — No-overlap constraint uses `tsrange` over UTC `timestamp(3)` columns

Status: Accepted

The appointment double-booking constraint uses `tsrange("startsAt", "endsAt", '[)')`
instead of the `tstzrange` shown conceptually in `docs/03-data-model.md`.

Reason:

- Prisma 6 maps `DateTime` to PostgreSQL `timestamp(3)` (without time zone) and writes UTC values.
- `tsrange` matches that column type exactly, avoiding an implicit `timestamp → timestamptz` cast that would depend on the database session's `TimeZone` setting.
- Because all stored values are UTC, overlap detection is timezone-independent and correct.
- The exclusion constraint is still enforced with `btree_gist` (`"doctorId" WITH =`, range `WITH &&`) and applies only to rows `WHERE ("status" = 'booked')`, so cancelled/completed/no-show appointments never block new bookings.
- If appointment columns are later switched to `timestamptz`, revisit this and use `tstzrange`.

## Decision 009 — Admin auth uses a signed-cookie session + scrypt, not Auth.js

Status: Accepted

Admin authentication is a lightweight, stateless, signed-cookie session built on
`node:crypto`, with `scrypt` password hashing. No third-party auth library
(Auth.js/NextAuth) and no new runtime dependency were added.

Reason:

- The MVP has a single trusted admin per clinic; a full auth framework (OAuth
  providers, adapters, account linking) is out of scope and would add surface
  area and dependencies for no current benefit.
- The session cookie is HMAC-SHA256-signed and carries only the admin user id
  plus an expiry. Authorization data (`clinicId`, `role`) is re-loaded from the
  database on every request and never trusted from the cookie, so a tampered or
  stale cookie cannot escalate privileges or cross clinics.
- Passwords are stored only as `scrypt` hashes; login compares against a cached
  dummy hash when the email is unknown, keeping timing roughly constant and
  preventing user enumeration. All credential failures return one generic error.
- Enforcement lives in the server (each protected page calls `requireAdmin`, and
  every admin server action re-checks the session) rather than in middleware,
  because Prisma and `scrypt` need the Node.js runtime, not the Edge runtime that
  `proxy.ts` runs in. Every admin query is scoped by `clinicId`.
- The session is signed with the existing `AUTH_SECRET` environment variable.
- This decision does not touch the `Appointment` schema. Appointments keep
  absolute UTC `startsAt`/`endsAt` plus a timezone, which remains compatible with
  future ICS calendar-invite support. Migrating to a managed auth provider later
  can be evaluated in a dedicated ADR.

## Decision 010 — Email uses a provider switch; SMTP (Gmail) for the trial, Resend deferred

Status: Accepted

Outbound email (booking confirmation, cancellation) goes through a single
`getEmailAdapter()` switch selected by the `EMAIL_PROVIDER` env var, with three
providers: `log` (default), `smtp` (via `nodemailer`), and `resend` (reserved).
The first real deployment uses SMTP through the doctor's existing Gmail account;
Resend is deferred until a sending domain is available.

Reason:

- The single-doctor trial must run for free without buying a domain. A
  transactional email provider such as Resend can only send to arbitrary
  recipients once a domain is verified by DNS (DKIM/SPF); a personal `gmail.com`
  address cannot be verified because its DNS is not under our control. Gmail SMTP
  (with a Google App Password and 2-Step Verification) sends real emails to
  patients at no cost, within Gmail's low daily limits, which suffice for one
  doctor.
- The default `log` provider sends nothing, so local development and trials never
  email real patients by accident. Incomplete SMTP settings fall back to `log`
  rather than failing a booking, because email is best-effort and must never roll
  back a successful appointment.
- `nodemailer` is a single, widely used, pure-JS dependency and runs only in the
  Node.js server (server actions), never on the Edge runtime. It is declared in
  `serverExternalPackages` so it is not bundled.
- Adapters never log recipients, subjects, bodies, or token-bearing cancellation
  links, preserving the existing privacy contract.
- Migrating to Resend (better deliverability, a branded sending domain) is a
  configuration change later — set `EMAIL_PROVIDER=resend` and add the adapter —
  without touching the booking or cancellation flows. This keeps the trial cheap
  now and the upgrade path open.

## Decision 011 — Separate pooled (`DATABASE_URL`) and direct (`DIRECT_URL`) database connections

Status: Accepted

The Prisma datasource declares both `url = env("DATABASE_URL")` (used at runtime)
and `directUrl = env("DIRECT_URL")` (used by Prisma migrations and introspection).

Reason:

- The target host is Vercel (serverless). Each function invocation can open its
  own database connection, so runtime queries must go through a connection
  pooler (e.g. Neon's pgBouncer `-pooler` endpoint) or the database's connection
  limit is quickly exhausted.
- Prisma Migrate cannot run through a transaction-mode pooler; it needs a direct
  connection. Splitting the two URLs lets runtime use the pool while migrations
  use a direct connection, which is Prisma's documented pattern for Neon/Vercel.
- For local single-Postgres development there is no pooler, so `DIRECT_URL` is
  set to the same value as `DATABASE_URL`; the split is transparent locally.
- This is configuration only — no schema model changed and no migration was
  required. `prisma generate` does not need `DIRECT_URL` (it does not connect),
  so client generation and the `postinstall` build step keep working even when
  only `DATABASE_URL` is set.

## Decision 012 — Tests use Vitest with separate unit and integration projects

Status: Accepted

The test suite is [Vitest](https://vitest.dev) with two projects:

- **unit** (`tests/unit/`) — pure, fast logic with no I/O (validation schemas,
  date/timezone math, availability interval helpers, CSV building, token
  hashing). Runs anywhere, including the pre-commit hook and CI without a
  database.
- **integration** (`tests/integration/`) — the real server modules against a
  real PostgreSQL database, including the `appointment_no_overlap` exclusion
  constraint, which is the source of truth for double-booking and cannot be
  exercised by mocks.

Reason and key choices:

- **Real database over mocks**: the core guarantees (no double-booking,
  availability math, soft-delete on cancellation, GDPR anonymization) live in SQL
  and Prisma transactions. Mocking Prisma would test the mock, not the behavior.
- **Dedicated `_test` database**: integration tests derive a database name from
  `DATABASE_URL` by suffixing `_test` (or use `TEST_DATABASE_URL`), so they never
  touch the development or production database. The schema is created on first
  run with `prisma migrate deploy`, so the migrations under test are the ones
  that ship.
- **Serialized integration run**: all integration files share one database and
  reset it per test, so they run in a single fork
  (`poolOptions.forks.singleFork`) to avoid cross-file truncation races.
  (`fileParallelism: false` is not valid at the project level.)
- **Soft-skip locally, hard-fail in CI**: if no database is reachable the
  integration project is skipped so contributors without Postgres still get a
  green unit run; when `CI=true` a missing database is a hard error so coverage
  cannot be silently lost.
- **Pre-commit enforcement**: a Husky hook runs `lint-staged`, `pnpm typecheck`,
  and `pnpm test` before each commit; integration tests skip cleanly when
  Postgres is down, and `git commit --no-verify` is the documented emergency
  bypass.

## Decision 013 — Single-tenant now, multi-tenant by changing one resolver

Status: Accepted

The MVP runs one clinic per deployment, but the data model is already
multi-tenant (every table carries `clinicId`; `Clinic` is the tenant). To keep
the upgrade path open without over-building now, the "which clinic is this public
request for?" decision lives in a single function,
`src/server/clinic/getActiveClinic.ts`. The public read models
(`getClinicProfile`, `getBookingContext`) and the landing page are built on top
of it.

Reason and key choices:

- Clinic identity and contact details are **data**, not code: `Clinic.name`,
  `Doctor.displayName`, and `Clinic.phone/email/address` come from the database
  (seeded from env), so a second clinic needs data, not a second deployment.
  Only generic, translatable UI labels stay in the i18n catalogs.
- Centralizing tenant resolution means the move to many clinics on one
  deployment changes essentially one function — resolve the clinic by URL slug
  (`/[clinic]/...`) or hostname instead of returning the first clinic — because
  every public read model already depends on it.
- All domain queries are already scoped by `clinicId`, and admin sessions
  re-load the clinic per request, so per-tenant isolation is enforced today.
- The full approach, trade-offs (one-deploy-per-clinic vs shared multi-tenant),
  and a migration checklist are documented in `docs/12-multi-tenancy.md`.


