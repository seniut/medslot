# GitHub Copilot Instructions — MedSlot

## Project context

MedSlot is a focused appointment calendar for healthcare professionals.

MVP features:

- patient booking page;
- admin calendar;
- patient cancellation link;
- manual patient/appointment entry by doctor;
- configurable working days/hours;
- blocked time;
- patient history;
- internal notes;
- CSV export/copy actions;
- Polish and English UI;
- GDPR/RODO-aware data handling.

Do not suggest building a marketplace, reviews, patient accounts, or full medical documentation unless explicitly requested.

## Stack

Use:

- Next.js App Router;
- TypeScript;
- PostgreSQL;
- Prisma;
- Tailwind CSS;
- shadcn/ui;
- Zod;
- next-intl or documented i18n dictionary approach;
- Resend/Postmark-style email adapter;
- Vercel-compatible deployment.

## Coding conventions

- Keep UI components in `src/components/*`.
- Keep server/business logic in `src/server/*`.
- Keep validation schemas in `src/lib/validation/*`.
- Keep Prisma client in `src/db/prisma.ts`.
- Use TypeScript types and avoid `any` unless there is a documented reason.
- Use server-side validation for all forms.
- Keep patient-facing UI mobile-first.
- Keep admin UI optimized for daily operational use.
- Add unit tests in `tests/unit/` for pure logic and integration tests in `tests/integration/` for server/database behavior; run `pnpm test` (integration tests need Postgres and auto-skip when it is absent).

## Domain rules

- Public pages must never expose patient data.
- All booking creation paths must re-check availability server-side.
- Double-booking must be prevented at the database level.
- Cancelled appointments remain in history; do not delete them.
- Manual appointments must use the same validation and overlap protection as public bookings.
- Store only hashed cancellation tokens.
- Doctor notes are internal notes, not full medical documentation in MVP.

## i18n rules

- No hardcoded user-facing text.
- Add Polish and English translations for every UI label/message.
- Validation messages must be localizable.
- Emails must be localizable.

## Documentation rules

When changing behavior, update:

- `CHANGELOG.md`;
- `PLANS.md` if milestone progress changes;
- relevant `docs/*` files;
- `DECISIONS.md` if architecture/product decisions change;
- `.env.example` when env vars change.

## Security/privacy rules

- Do not log patient notes, phone, email, raw tokens, or secrets.
- Use auth checks on all admin routes/actions.
- Use clinic/doctor scoping in queries.
- Audit sensitive actions: booking, cancellation, export, notes, working hours changes.
- If a change affects GDPR/RODO behavior, update `docs/04-gdpr-rodo.md`.

## Preferred response style

When asked to implement a feature:

1. Briefly summarize the requirement.
2. Identify files to change.
3. Implement small scoped changes.
4. Update docs/changelog.
5. Run or suggest validation commands (`pnpm check`, `pnpm test`).

