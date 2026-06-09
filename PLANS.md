# Execution Plan

This file is the source of truth for MVP implementation phases. Codex/Copilot must update this file when milestones change.

## Milestone 0 — Project bootstrap

Status: ✅ Completed (2026-06-05).

Goal: create clean Next.js app with basic tooling.

Tasks:

- [x] Create Next.js App Router project with TypeScript (Next.js 16, strict TS).
- [x] Add Tailwind CSS and shadcn/ui (Tailwind v4 + shadcn foundation and `Button`).
- [x] Add ESLint/Prettier (ESLint 9 flat config, Prettier 3 + Tailwind plugin).
- [x] Add Prisma (v6 client + minimal schema + `src/db/prisma.ts` singleton).
- [x] Add base folder structure (`src/server|components|lib`, `src/i18n`).
- [x] Add `.env.example` (already present; unchanged).
- [x] Add docs and agent instructions (already present; updated for bootstrap).
- [x] Add `next-intl` Polish/English locale routing (`/pl`, `/en`).

Validation:

- [x] `pnpm lint` passes.
- [x] `pnpm typecheck` passes.
- [x] `pnpm build` passes.
- [x] App starts with `pnpm dev` (`/` → `/pl`; `/pl` and `/en` return 200).

## Milestone 1 — Database model and migrations

Status: ✅ Completed (2026-06-05). Migrations authored and validated without a live
database (`prisma migrate diff` + `prisma validate`); apply with `prisma migrate deploy`
once a `DATABASE_URL` is available.

Goal: create initial database schema.

Tasks:

- [x] Add Prisma models:
  - [x] Clinic
  - [x] Doctor
  - [x] Patient
  - [x] Appointment
  - [x] DoctorNote
  - [x] WorkingHour
  - [x] BlockedTime
  - [x] ConsentRecord
  - [x] AuditLog
- [x] Add appointment status enum (`AppointmentStatus`; plus `AppointmentSource`).
- [x] Add raw SQL migration for no-overlap appointment constraint (`btree_gist` GiST exclusion; uses `tsrange`, see DECISIONS.md 008).
- [x] Add seed script with one clinic and one doctor (`prisma/seed.ts`, idempotent).

Validation:

- [x] Schema validates (`pnpm prisma validate`) and client generates (`pnpm prisma generate`).
- [x] `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass.
- [x] `pnpm prisma migrate dev` applied against a live PostgreSQL (Docker `postgres:16`).
- [x] Tables verified via `psql` (Prisma Studio 6.x has an unrelated UI bug; data confirmed directly).

## Milestone 2 — Patient booking flow

Status: ✅ Completed (2026-06-05). Validated end-to-end against the live database:
booked a slot through the UI, confirmed the appointment/consent/audit rows, verified
the booked slot disappears from availability, and confirmed the DB exclusion
constraint rejects an overlapping insert.

Goal: patients can book available slots.

Tasks:

- [x] Public booking page (`src/app/[locale]/booking/page.tsx`).
- [x] Available slot calculation (`src/server/appointments/getAvailability.ts`, timezone/DST-correct).
- [x] Booking form with Zod validation (`src/lib/validation/bookingSchema.ts`, `src/components/booking/*`).
- [x] Server-side booking creation (`createAppointment` + `actions.ts`, transactional).
- [x] Double-booking protection (server re-check + `appointment_no_overlap` GiST constraint).
- [x] Confirmation page (`src/app/[locale]/booking/confirmation/page.tsx`, PII-free).
- [x] Confirmation email adapter (`src/server/email/*`, log-only in MVP, localized message).

Validation:

- [x] Patient can book a slot.
- [x] Same slot cannot be double-booked.
- [x] Booked slot disappears from availability.
- [x] Invalid forms are rejected server-side.

## Milestone 3 — Cancellation flow

Status: ✅ Completed (2026-06-05). Validated end-to-end against the live database:
booked a slot, opened its token-based cancel link, confirmed cancellation, and verified
the appointment row flips to `cancelled_by_patient` with `cancelledAt` set (record kept),
an `appointment.cancelled_by_patient` audit row is written, the freed 09:00 slot reappears
in availability, and invalid/already-cancelled tokens render safe messages with no patient
data. Verified in both `pl` and `en` (localized dates).

Goal: patients can cancel via secure link.

Tasks:

- [x] Generate secure cancellation token (Milestone 2: `src/lib/security/tokens.ts`).
- [x] Store only token hash (`Appointment.cancelTokenHash`, SHA-256).
- [x] Add cancellation page (`src/app/[locale]/cancel/[token]/page.tsx`, PII-free).
- [x] Cancel appointment by token (`src/server/appointments/cancelAppointment.ts`, transactional + audited).
- [x] Send cancellation email/notification (`src/server/email/sendCancellationEmail.ts`, localized, log-only in MVP).

Validation:

- [x] Patient can cancel active booking.
- [x] Cancelled appointment remains in history.
- [x] Cancelled future slot becomes available again.
- [x] Invalid token fails safely.

## Milestone 4 — Admin authentication and calendar

Status: ✅ Completed (2026-06-06). Validated end-to-end against the live database:
visiting a protected page while signed out redirects to `/admin/login`; signing in with the
seeded admin shows the day calendar with patient names, contact, source, and status; creating
a manual appointment persists it (`source = manual_admin`, booked) and audits
`appointment.created_manual`; an overlapping manual appointment is rejected ("That time
overlaps another appointment") with no row written; marking the appointment completed flips
its status (`completedAt` set) and audits `appointment.completed`; logging out clears the
session so the protected page redirects to login again. Verified the Polish admin UI renders
with no missing-translation warnings. `pnpm check` (lint + typecheck + build) is green.

Goal: doctor can manage appointments.

Tasks:

- [x] Admin login (`src/app/[locale]/admin/login/page.tsx` + `authActions.ts`, scrypt + signed-cookie session).
- [x] Protected admin layout (per-page `requireAdmin` guard + shared `AdminShell`).
- [x] Admin calendar view (`src/app/[locale]/admin/calendar/page.tsx`, `getAdminCalendarDay`).
- [x] Appointment details panel (`src/app/[locale]/admin/appointments/[id]/page.tsx`, `getAppointmentDetail`).
- [x] Mark completed/no-show/cancelled (`adminActions.ts`, clinic-scoped + audited).
- [x] Manual appointment creation (`createManualAppointment.ts`, same overlap protection as public booking).

Validation:

- [x] Unauthenticated users cannot access admin pages.
- [x] Doctor sees patient names and contact details.
- [x] Doctor can create manual appointment.
- [x] Manual appointment uses the same double-booking rules.

## Milestone 5 — Working hours and blocked time

Goal: doctor controls availability.

Status: ✅ Completed (2026-06-06). Validated end-to-end against the live database:
admin Availability page renders the seven weekday rows and the blocked-time
editor in both Polish and English; narrowing Monday to 09:00–12:00 immediately
removed the afternoon slots from the public booking page for that weekday;
adding a 09:00–10:00 block dropped the 09:00/09:30 slots (10:00 correctly
retained at the boundary) and removing it restored them; `working_hours.updated`,
`blocked_time.created`, and `blocked_time.deleted` audit rows were written;
`pnpm check` (lint + typecheck + build) is green. No schema change or migration
was needed — the data model and availability engine from Milestones 1–2 already
support working hours and blocked time.

Tasks:

- [x] Working hours settings page.
- [x] Weekday-based working hours.
- [x] Blocked time creation.
- [x] Slot calculation uses working hours and blocked times.

Validation:

- [x] Changing working hours changes patient-facing availability.
- [x] Blocked time is not bookable.

## Milestone 6 — History, notes, export

Goal: doctor can use the system operationally.

Status: ✅ Completed (2026-06-07). Validated end-to-end against the live database:
the patient list (`/admin/patients`, linked from the admin nav) shows visit
counts and last visit; a patient detail page renders full visit history
including a `cancelled_by_patient` visit, and a completed manual visit appears
for another patient; adding a patient note and an appointment-linked note both
persisted (the linked note shows a "Linked to a visit" tag), wrote
`note.created` audit rows with `hasAppointment` true/false and no note content,
and reset the form with a saved confirmation; the CSV export
(`/api/admin/export/appointments`) returned `text/csv` with a download filename,
CRLF rows, both visit statuses, clinic-local dates/times, and the CSV-injection
guard prefixing phone numbers (`+48…` → `'+48…`), and wrote an
`export.appointments_csv` audit row with only the range and count; the Polish UI
rendered with no missing-message warnings; `pnpm check` (lint + typecheck +
build) is green. No schema change or migration was needed — the `DoctorNote`
model from Milestone 1 already supports patient and appointment notes.

Tasks:

- [x] Patient list.
- [x] Patient visit history.
- [x] Appointment notes.
- [x] Patient notes.
- [x] Copy-to-clipboard patient/visit summary.
- [x] CSV export by date range.

Validation:

- [x] Patient history includes completed/cancelled/no-show visits.
- [x] CSV export works.
- [x] Notes are visible only in admin.

## Milestone 7 — GDPR/RODO hardening

Goal: make MVP safer for real usage.

Status: ✅ Completed (2026-06-07). Validated end-to-end against the live
database. A public, versioned privacy policy page (`/[locale]/privacy`) renders
in Polish and English and is linked from the booking consent block and the home
page. Per-patient data export (`/api/admin/patients/[id]/export`) returned a
`200` JSON attachment (`no-store`) with the patient's profile, appointments,
notes, and consent records, and wrote a `patient.exported` audit row holding
only counts (no PII). The manual anonymization workflow on the patient detail
page is confirmation-gated (submitting unchecked surfaces a localized "Please
confirm to continue."); anonymizing a patient redacted the name to "Anonymized
Patient", cleared phone/email, set `anonymizedAt` (leaving `deletedAt` null so
the record stays listable with an "Anonymized" badge), deleted both internal
notes, preserved the cancelled visit in history, and wrote a `patient.anonymized`
audit row with only counts (`reason`, `notesDeleted`, `appointmentsRedacted`).
The retention sweep CLI (`pnpm retention:sweep`) ran, reported its window
(24 months), cutoff, and scanned/anonymized/skipped counts, and correctly
anonymized nobody (no patient was past the cutoff without a future appointment).
Consent capture/versioning and per-action audit logging were already delivered
in Milestones 2–6 and are reused here. `pnpm check` (lint + typecheck + build) is
green. No schema change or migration was needed — `Patient.anonymizedAt` /
`deletedAt` and `ConsentRecord` from Milestone 1 already support this; the
`Appointment` schema was left untouched to keep future ICS support open.

Tasks:

- [x] Privacy policy page.
- [x] Consent capture and versioning. _(Delivered in Milestone 2; linked to the new privacy page here.)_
- [x] Data retention job design. _(Configurable `retentionSweep` + `pnpm retention:sweep` CLI, `RETENTION_MONTHS`.)_
- [x] Data export function. _(Per-patient JSON export, admin-only, audited.)_
- [x] Soft delete/anonymization workflow. _(Anonymize patient: redact + `anonymizedAt`, notes deleted, messages cleared.)_
- [x] Audit logging for sensitive actions. _(Added `patient.exported`, `patient.anonymized`, `retention.anonymized`.)_
- [x] Admin warning for notes field. _(Delivered in Milestone 6.)_

Validation:

- [x] Consent record is saved for each booking.
- [x] Audit log records booking/cancel/export/note actions (plus export, anonymize, retention).
- [x] Retention policy is documented and configurable.

## Milestone 8 — Deploy preparation and automated tests

Status: ✅ Completed.

Goal: make the MVP safe to deploy on the free stack and protect it with an
automated test suite.

Deploy preparation:

- [x] Runtime/migration connection split (`DATABASE_URL` pooled + `DIRECT_URL` direct) for serverless (Vercel) + Neon. _(Decision 011.)_
- [x] `EMAIL_PROVIDER` switch with a default `log` provider and an SMTP (Gmail) provider for the trial. _(Decision 010.)_
- [x] `postinstall` runs `prisma generate`; `nodemailer` declared in `serverExternalPackages`.
- [x] Env-driven, idempotent seed (clinic/doctor/admin) for one-shot production seeding.
- [x] Free-stack deploy checklist (Neon EU + Gmail + Vercel Hobby) and an end-to-end git-to-deploy guide in `docs/07-runbook-dev-deploy.md`.
- [x] `docker-compose.yml` for a local PostgreSQL.

Automated tests:

- [x] Vitest with `unit` and `integration` projects, path aliases, and a `server-only` stub.
- [x] Unit tests for validation schemas, date/timezone math, availability helpers, CSV building, and token hashing.
- [x] Integration tests against a real PostgreSQL `_test` database (auto-migrated) for booking, the no-overlap constraint, availability, cancellation, manual appointments, working hours, blocked time, patient history, notes, GDPR anonymization/retention, and CSV export.
- [x] Integration tests skip safely when no database is reachable (hard-fail in CI).
- [x] Husky pre-commit hook (`lint-staged` + `typecheck` + `test`); `verify` script.

Validation:

- [x] `pnpm check` passes.
- [x] `pnpm test` passes (unit + integration) against a local PostgreSQL.
- [x] `pnpm test:unit` passes without any database; integration tests skip (not fail) when the database is unreachable.

## Post-MVP milestones

- SMS reminders.
- Online payments.
- Multi-doctor support.
- Google Calendar sync.
- Custom domains.
- White-label branding.
- More granular roles.
- Medical documentation module only after legal/technical design review.
