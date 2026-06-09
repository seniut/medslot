# AGENTS.md — Codex Instructions for MedSlot

You are working on **MedSlot**, a Next.js + TypeScript + PostgreSQL + Prisma appointment calendar for healthcare professionals.

## Product goal

Build a focused MVP:

- public appointment booking calendar;
- admin calendar for doctor;
- patient cancellation via secure link;
- manual appointment creation by doctor;
- configurable working days/hours;
- visit history;
- internal notes;
- CSV export and copy actions;
- Polish and English UI;
- GDPR/RODO-aware data handling.

Do not build a full medical documentation system or marketplace unless explicitly requested.

## Read first

Before implementing any non-trivial task, read:

- `README.md`
- `PLANS.md`
- `DECISIONS.md`
- `docs/01-product-spec.md`
- `docs/02-architecture.md`
- `docs/03-data-model.md`
- `docs/04-gdpr-rodo.md`
- `docs/05-i18n.md`
- `docs/07-runbook-dev-deploy.md`

## Tech stack

Use:

- Next.js App Router;
- TypeScript;
- PostgreSQL;
- Prisma;
- Tailwind CSS;
- shadcn/ui;
- FullCalendar for admin calendar if needed;
- simple patient-facing date/slot picker;
- Zod for validation;
- Resend/Postmark-compatible email adapter;
- Vercel-compatible deployment.

## Engineering rules

1. Keep the project as a modular monolith.
2. Keep business logic in `src/server/*`, not scattered in UI components.
3. Keep Prisma client setup in `src/db/prisma.ts`.
4. Use Zod for server-side validation.
5. All public booking mutations must re-check availability on the server.
6. Booking overlap prevention must rely on PostgreSQL transaction/constraint, not only frontend checks.
7. Never expose patient data on public pages.
8. Never store raw cancellation tokens; store only hashes.
9. Never physically delete appointments for normal cancellation; change status.
10. All user-facing text must be localizable in Polish and English.
11. Avoid logging patient note content, phone, email, raw tokens, or secrets.
12. Do not add dependencies without explaining why.
13. Keep changes scoped to the requested task.

## Documentation rules

Every feature/change must update relevant documentation:

- `README.md` if setup/usage changes;
- `PLANS.md` if milestone progress changes;
- `CHANGELOG.md` for product or behavior changes;
- `DECISIONS.md` for architectural/product decisions;
- `docs/*` for corresponding domain changes;
- `.env.example` if environment variables change.

If you change GDPR/RODO-relevant behavior, update `docs/04-gdpr-rodo.md`.

If you add/change user-facing text, update i18n files.

## Commands

Common commands:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm check             # lint + typecheck + build
pnpm test              # unit + integration tests
pnpm test:unit         # unit tests only (no database)
pnpm test:integration  # integration tests (needs Postgres; auto-skips if absent)
pnpm verify            # lint + typecheck + test
pnpm prisma generate
pnpm prisma migrate dev
pnpm prisma migrate deploy
pnpm prisma studio
```

If a command fails because scripts are not yet configured, update `package.json` or explain what is missing.

## Testing/validation expectations

After each meaningful change:

- run `pnpm check` (lint/typecheck/build) and `pnpm test` if possible;
- add or update unit tests (`tests/unit/`) for changed pure logic;
- add or update integration tests (`tests/integration/`) for changed server/database behavior;
- start Postgres (`docker compose up -d`) so integration tests run instead of skipping;
- validate booking flow manually if changed;
- validate cancellation flow manually if changed;
- validate admin authorization if admin area changed;
- validate i18n if UI text changed;
- validate migrations if database changed.

## Privacy and compliance rules

- Treat patient data as sensitive.
- Treat doctor notes as potentially sensitive.
- MVP notes are internal notes, not full medical documentation.
- Add warning text near notes fields.
- Do not implement full medical records functionality without explicit legal/technical design.
- Keep consent/privacy versioning for public bookings.
- Audit sensitive actions.

## Database rules

- Use migrations; do not use `db push` for production workflow.
- Review migrations before applying.
- For schema changes, update `docs/03-data-model.md`.
- Calendar queries must use date ranges.
- Add indexes only when justified by query patterns.

## Done definition

A task is done when:

- code is implemented;
- relevant docs are updated;
- migrations are included if needed;
- i18n messages are updated if needed;
- privacy impact is considered;
- validation commands have been run or limitations explained;
- changelog is updated.

