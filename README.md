# MedSlot — Universal Appointment Calendar for Healthcare Professionals

> Working product name: **MedSlot**. Use it as an internal repository name until a legal/trademark/domain check is done.

MedSlot is a minimal, production-oriented appointment calendar for a doctor/physiotherapist/healthcare professional.

The first MVP is intentionally narrow:

- public booking calendar for patients;
- admin calendar for the doctor;
- patient self-cancellation via secure link;
- manual patient/appointment creation by the doctor;
- visit history;
- internal doctor notes;
- CSV export and copy-to-clipboard actions;
- Polish and English UI;
- configurable working days and working hours;
- GDPR/RODO-aware data handling.

This repository is built as a **modular monolith** using:

- Next.js App Router + TypeScript;
- PostgreSQL + Prisma;
- Tailwind CSS + shadcn/ui;
- next-intl (Polish/English);
- a lightweight signed-cookie admin session with scrypt password hashing;
- a pluggable email adapter (log by default, SMTP/Gmail for real email);
- custom day-view admin calendar and patient slot picker (no calendar library);
- Vitest unit + integration tests;
- Vercel for deployment.

## Project status

Milestones 0–8 are complete: public booking, admin calendar, secure cancellation,
manual appointments, configurable working hours and blocked time, patient history,
internal notes, CSV export, GDPR/RODO hardening, deploy preparation, and an
automated test suite. The app runs on Next.js 16
with TypeScript, Tailwind CSS v4, shadcn/ui, Prisma 6 (PostgreSQL), and
Polish/English routing via `next-intl`, and is covered by a Vitest unit +
integration test suite. See `PLANS.md` for milestone progress and
`docs/07-runbook-dev-deploy.md` for the deploy guide.

## Getting started

```bash
# Enable pnpm (bundled with Node via Corepack) if it is not installed
corepack enable pnpm

pnpm install
pnpm prisma generate
pnpm dev          # http://localhost:3000 → redirects to /pl
```

Useful commands:

```bash
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm build        # production build
pnpm check        # lint + typecheck + build
pnpm test         # unit + integration tests (Vitest)
pnpm test:unit    # unit tests only (no database)
pnpm verify       # lint + typecheck + test
pnpm format       # Prettier
```

A PostgreSQL `DATABASE_URL` (see `.env.example`) is required for the app and for
the integration tests. The fastest local database is Docker:

```bash
docker compose up -d   # Postgres on localhost:5432 (see docker-compose.yml)
```

## Testing

Tests run on [Vitest](https://vitest.dev) and are split into two projects:

- **Unit** (`tests/unit/`) — pure logic with no database: validation schemas,
  date/timezone math, availability helpers, CSV building, and token hashing.
- **Integration** (`tests/integration/`) — real server logic against a real
  PostgreSQL database: booking, double-booking via the database exclusion
  constraint, availability, cancellation, working hours, blocked time, patient
  history, notes, GDPR anonymization/retention, and CSV export.

```bash
pnpm test              # unit + integration
pnpm test:unit         # unit only — no database needed
pnpm test:integration  # integration only
pnpm test:coverage     # coverage report
```

Integration tests use a dedicated database derived from `DATABASE_URL` (the name
is suffixed with `_test`, e.g. `medslot` → `medslot_test`), or `TEST_DATABASE_URL`
if set. The schema is created automatically with `prisma migrate deploy`, so you
only need a running Postgres (`docker compose up -d`). If no database is reachable
the integration tests are **skipped** (not failed) locally; in CI a missing
database fails the run.

A Husky pre-commit hook runs `lint-staged`, `pnpm typecheck`, and `pnpm test`
before each commit (active after `pnpm install` in a Git repo). Bypass with
`git commit --no-verify` only in emergencies.

## Product philosophy

Do not build a full ZnanyLekarz clone first.

Build a reliable calendar system that solves one concrete problem:

> Patients can book and cancel visits online. The doctor can see who is coming, manage the calendar, keep visit history, add internal notes, and export visit data.

## Current MVP scope

### Patient side

- See available dates and slots.
- Book a visit without creating an account.
- Provide first name, last name, phone, email.
- Accept privacy/data processing information.
- Receive confirmation email.
- Cancel a visit using a secure cancellation link.

### Doctor/admin side

- Login to admin panel.
- See the day's calendar with date navigation.
- See patient details inside booked slots.
- Create manual appointments for phone/Instagram/WhatsApp bookings.
- Edit/cancel appointments.
- Mark appointments as completed or no-show.
- Add internal notes.
- View patient visit history.
- Configure working days and hours.
- Block time manually.
- Export appointments to CSV.
- Copy patient/visit summary to clipboard.

## Important legal boundary

MVP notes must be treated as **internal administrative notes**, not as full medical documentation.

If the system stores diagnoses, symptoms, injury descriptions, treatment recommendations, rehabilitation plans, or full visit notes, it may become a system processing health data / medical documentation. That requires stronger legal, organizational, and technical controls.

For MVP, keep the product positioned as:

> appointment calendar + basic visit history + internal notes

not as:

> full electronic medical documentation system

## Documentation map

- `docs/01-product-spec.md` — product requirements and MVP scope.
- `docs/02-architecture.md` — system architecture and project structure.
- `docs/03-data-model.md` — database model and constraints.
- `docs/04-gdpr-rodo.md` — GDPR/RODO checklist and implementation requirements.
- `docs/05-i18n.md` — Polish/English language implementation.
- `docs/06-roadmap.md` — MVP and post-MVP roadmap.
- `docs/07-runbook-dev-deploy.md` — local setup, commands, deployment, migration flow.
- `docs/08-performance-operations.md` — performance, database growth, backups, monitoring.
- `docs/09-ai-workflow-prompts.md` — prompts for Copilot/Codex and how to continue work in VS Code.
- `docs/10-feature-backlog.md` — future feature ideas.
- `docs/11-database-access.md` — connecting to the database (local + Neon/production) and example queries.
- `docs/12-multi-tenancy.md` — scaling from one clinic to many clinics on one platform.
- `.github/copilot-instructions.md` — GitHub Copilot repository-wide instructions.
- `AGENTS.md` — Codex repository instructions.
- `PLANS.md` — milestone execution plan.
- `CHANGELOG.md` — product change history.
- `DECISIONS.md` — important architecture and product decisions.

## Non-negotiable engineering rules

1. Every feature must update relevant docs.
2. Every database change must use a migration.
3. Every booking creation path must go through the same server-side availability and double-booking protection.
4. Never expose patient data in the public calendar.
5. Never delete appointments physically when cancelled; change status instead.
6. Never store raw cancellation tokens; store only hashes.
7. Validate all forms server-side using Zod.
8. Keep patient-facing UI simple and mobile-first.
9. Keep doctor/admin UI optimized for daily work.
10. Treat privacy and auditability as part of MVP, not as a later add-on.

