# 02 — Architecture

## Architecture style

Use a **modular monolith**.

That means:

- one Next.js application;
- one PostgreSQL database;
- one deployment pipeline;
- clear internal modules;
- no separate backend service in MVP.

This is intentionally simpler than a microservice architecture.

## Why modular monolith

The product is small but needs reliable domain logic.

A modular monolith gives:

- fast development;
- simple deployment;
- no frontend/backend split overhead;
- easy local development;
- clear path to extraction later if needed.

Avoid overengineering with Kubernetes, separate NestJS backend, queues, Redis, and event buses in the MVP.

## High-level flow

```text
Patient Browser
  -> Public Next.js Booking Page
  -> Server Action / Route Handler
  -> Booking Service
  -> PostgreSQL
  -> Email Adapter

Doctor Browser
  -> Admin Next.js Pages
  -> Protected Server Actions / Route Handlers
  -> Appointment/Patient/Notes Services
  -> PostgreSQL
```

## Suggested folder structure

```text
src/
  app/
    [locale]/
      page.tsx
      booking/
        page.tsx
        confirmation/
          page.tsx
      cancel/
        [token]/
          page.tsx
      admin/
        layout.tsx
        calendar/
          page.tsx
        appointments/
          [id]/
            page.tsx
        patients/
          page.tsx
          [id]/
            page.tsx
        settings/
          page.tsx
        export/
          page.tsx

  components/
    booking/
      DateSelector.tsx
      SlotPicker.tsx
      BookingForm.tsx
      BookingConfirmation.tsx
    admin/
      AdminCalendar.tsx
      AppointmentDetails.tsx
      ManualAppointmentForm.tsx
      WorkingHoursForm.tsx
      PatientHistory.tsx
      NotesPanel.tsx
      ExportVisitsForm.tsx
    ui/
      # shadcn components

  server/
    appointments/
      createAppointment.ts
      createManualAppointment.ts
      cancelAppointmentByToken.ts
      cancelAppointmentByAdmin.ts
      getAvailableSlots.ts
      markAppointmentCompleted.ts
      markAppointmentNoShow.ts
      exportAppointmentsCsv.ts
    patients/
      findOrCreatePatient.ts
      getPatientHistory.ts
      updatePatient.ts
    notes/
      addDoctorNote.ts
      updateDoctorNote.ts
      deleteDoctorNote.ts
    working-hours/
      getWorkingHours.ts
      updateWorkingHours.ts
    blocked-times/
      createBlockedTime.ts
      deleteBlockedTime.ts
    audit/
      logAuditEvent.ts
    consent/
      createConsentRecord.ts
    email/
      sendBookingConfirmation.ts
      sendDoctorNotification.ts
      sendCancellationConfirmation.ts
    auth/
      requireAdmin.ts

  db/
    prisma.ts

  i18n/
    routing.ts
    request.ts
    messages/
      pl.json
      en.json

  lib/
    date-time/
      timezone.ts
      intervals.ts
    security/
      tokens.ts
      hashing.ts
    validation/
      bookingSchema.ts
      appointmentSchema.ts
      workingHoursSchema.ts
      noteSchema.ts
    export/
      csv.ts

prisma/
  schema.prisma
  migrations/
  seed.ts
```

## Module boundaries

### UI components

Components must not directly perform database queries.

Bad:

```tsx
const appointments = await prisma.appointment.findMany();
```

inside random UI component.

Good:

```tsx
const appointments = await getAdminCalendarAppointments(...);
```

from a server module.

### Server modules

Server modules contain business logic:

- create booking;
- cancel booking;
- calculate slots;
- validate admin actions;
- export CSV;
- log audit events.

### Database layer

Keep Prisma client initialization in one place:

```text
src/db/prisma.ts
```

### Validation layer

All forms must have server-side Zod validation.

Client-side validation is useful for UX but not sufficient.

## Core domain services

### `getAvailableSlots()`

Inputs:

- clinic/doctor id;
- date range;
- appointment duration;
- slot step;
- timezone.

Uses:

- working hours;
- blocked times;
- booked appointments;
- minimum booking notice;
- maximum booking window.

Returns:

- list of bookable slots.

### `createAppointment()`

Used by public booking.

Responsibilities:

- validate input;
- find or create patient;
- check availability;
- create appointment in transaction;
- rely on DB no-overlap constraint;
- create consent record;
- create audit log;
- generate cancellation token;
- send emails after successful commit.

### `createManualAppointment()`

Used by admin.

Responsibilities:

- validate admin session;
- validate input;
- find or create patient;
- create appointment with `source = manual`;
- use the same overlap protection;
- audit action.

### `cancelAppointmentByToken()`

Used by patient cancellation link.

Responsibilities:

- hash incoming token;
- find active appointment;
- update status;
- audit action;
- notify doctor/patient.

### `exportAppointmentsCsv()`

Used by admin.

Responsibilities:

- validate admin session;
- validate date range;
- query appointments;
- include patient data;
- optionally include notes;
- audit export action;
- return CSV.

## API design

Prefer Server Actions for form mutations when practical.

Use Route Handlers for:

- CSV downloads;
- webhooks;
- future API integrations;
- cancellation if simpler.

## Timezone design

Store absolute timestamps in the database.

Recommended:

- store `startsAt` and `endsAt` as timezone-aware timestamps;
- treat `Europe/Warsaw` as default timezone;
- convert to local display time in UI;
- avoid manual string concatenation for dates/times.

## Public vs admin data exposure

Public booking endpoints may return:

- available slots;
- basic doctor/clinic display information.

Public booking endpoints must not return:

- patient names;
- patient emails;
- patient phone numbers;
- notes;
- full list of booked appointments.

## Error handling

Use typed/domain errors:

- `SlotUnavailableError`;
- `AppointmentNotFoundError`;
- `InvalidCancellationTokenError`;
- `UnauthorizedError`;
- `ValidationError`.

User-facing messages must be localized.

## Logging

Do not log sensitive patient data.

Allowed logs:

- appointment id;
- doctor id;
- event type;
- error code;
- timestamp.

Avoid logs like:

- patient phone;
- patient email;
- note content;
- medical details.

## Admin authentication (implementation status, Milestone 4)

The admin area is implemented as follows (see `DECISIONS.md`, Decision 009):

- **Session**: a stateless, HMAC-SHA256-signed cookie (`src/server/auth/session.ts`) carrying only the admin user id and an expiry. It is signed with `AUTH_SECRET`.
- **Identity vs authorization**: `getAdminSession()` reads the cookie and re-loads the `AdminUser` (clinic, role, email) from the database on every request; clinic and role are never trusted from the cookie.
- **Enforcement**: each protected page calls `requireAdmin(locale)` (redirects to `/admin/login` when there is no valid session) and every admin server action (`src/server/appointments/adminActions.ts`, `src/server/auth/authActions.ts`) re-checks the session. Guarding lives in the Node.js server layer rather than `proxy.ts`, because Prisma and `scrypt` are not available in the Edge runtime.
- **Passwords**: stored only as `scrypt` hashes (`src/lib/security/password.ts`); login uses a constant-time dummy-hash comparison and a single generic error to avoid user enumeration.
- **Scoping & audit**: all admin reads/writes are scoped by `clinicId`; manual creation reuses the public booking overlap protection; status transitions and manual creation are audited.
- **Routing**: protected pages live directly under `src/app/[locale]/admin/{calendar,appointments}` and share an `AdminShell` component instead of a route-group layout, keeping route param types simple.

## Availability management (implementation status, Milestone 5)

The doctor controls availability from the admin Availability page (`/[locale]/admin/settings`, linked from the admin nav):

- **Working hours**: `src/server/availability/{getWorkingHours,updateWorkingHours}.ts` read and persist the seven weekday rows. Saving uses replace-all semantics inside one transaction (delete then `createMany`), so the stored schedule always matches the editor. All seven days are stored; inactive days persist their times but never produce slots because the availability engine filters on `isActive`.
- **Blocked time**: `src/server/availability/{getBlockedTimes,createBlockedTime,deleteBlockedTime}.ts` list upcoming blocks and create/remove them. The form's date plus start/end wall-clock times are interpreted in the clinic timezone and stored as absolute UTC instants (`zonedWallTimeToUtc`), so blocks line up with appointments and survive DST. Deletion is scoped by `clinicId`.
- **No new read path**: the existing availability engine (`getAvailability.ts`, Milestone 2) already consumes active working hours and blocked time, so editing either immediately re-shapes the public booking date list and time slots (both `/[locale]/admin/settings` and `/[locale]/booking` are revalidated after each change).
- **Scoping & audit**: all reads/writes are clinic-scoped and audited (`working_hours.updated`, `blocked_time.created`, `blocked_time.deleted`); the page exposes no patient data and the free-text block reason is never written to the audit log.
- **No schema change**: Milestone 5 reused the `WorkingHour` and `BlockedTime` models from Milestone 1; no migration was required.

## Patient history, notes, and export (implementation status, Milestone 6)

The doctor works with patients operationally from the admin area:

- **Patient list & history**: `src/server/patients/{getPatients,getPatientDetail}.ts` back the patient list (`/[locale]/admin/patients`, linked from the admin nav) and the patient detail page (`/[locale]/admin/patients/[id]`). The list shows visit counts and last visit; the detail page shows the full visit history with **every** status (completed, cancelled, no-show), so cancelled visits remain visible as history.
- **Internal notes**: `src/server/notes/{createNote,noteActions}.ts` create `DoctorNote` rows. A note always belongs to a patient and may optionally be linked to an appointment (`appointmentId`). The add-note form (`src/components/admin/note-form.tsx`) appears on both the patient detail and appointment detail pages and carries a GDPR/RODO warning; `getAppointmentDetail` now also returns the patient id and the appointment's notes. Note creation verifies the patient (and any linked appointment) belong to the clinic before writing.
- **Copy helpers**: `src/components/admin/copy-button.tsx` provides "Copy contact" (patient page) and "Copy visit summary" (appointment page); the summary text is built server-side from admin-only data and copied via the clipboard API.
- **CSV export**: `src/server/export/exportAppointments.ts` builds a CSV of visits for an inclusive clinic-local date range (every status), rendered in the clinic timezone. It is served by a `nodejs` route handler at `/api/admin/export/appointments` (outside the locale middleware) that authenticates via the admin session cookie, validates the range with `exportRangeSchema`, and streams a `text/csv` attachment (UTF-8 BOM + CRLF for spreadsheet compatibility). The export form lives on the patient list page. The CSV builder (`src/lib/csv.ts`) is hardened against formula injection: cells beginning with `=`, `+`, `-`, `@`, tab, or carriage return are apostrophe-prefixed before RFC-4180 quoting.
- **Scoping & audit**: every patients/notes/export path enforces the admin session and scopes queries by `clinicId`, so patient data and notes never appear on public pages. Note creation and export are audited (`note.created`, `export.appointments_csv`); note content is never logged (only a `hasAppointment` flag) and the export audit records only the date range and row count.
- **No schema change**: Milestone 6 reused the `DoctorNote` model from Milestone 1; no migration was required.

## Privacy, data rights, and retention (implementation status, Milestone 7)

GDPR/RODO operational flows are implemented across public and admin surfaces:

- **Privacy policy page**: a public page at `/[locale]/privacy` (`src/app/[locale]/privacy/page.tsx`) renders versioned privacy text from the `privacy` i18n namespace (showing `PRIVACY_TEXT_VERSION`). It is linked from the booking consent block (`src/components/booking/booking-form.tsx`) and the home page, and exposes no patient data.
- **Per-patient data export (access/portability)**: `src/server/patients/exportPatientData.ts` assembles a patient's profile, appointments, notes, and consent records; a `nodejs` route handler at `/api/admin/patients/[id]/export` (outside the locale middleware) authenticates via the admin session cookie and streams a JSON attachment (`no-store`). The export is clinic-scoped; a patient from another clinic is treated as not found.
- **Anonymization (erasure)**: `src/server/patients/anonymizePatient.ts` redacts name/contact fields to neutral placeholders (`src/lib/retention-config.ts`), sets `anonymizedAt`, clears appointment `patientMessage` values, and deletes the patient's `DoctorNote` rows, all in one transaction, while keeping the appointments. It refuses to run while the patient has a future `booked` appointment and is idempotent. The admin UI is a confirmation-gated destructive form (`src/components/admin/anonymize-patient-form.tsx`, `src/server/patients/patientActions.ts`, validated by `src/lib/validation/patientSchema.ts`); the patient list and detail pages show an "Anonymized" badge.
- **Retention sweep**: `src/server/retention/retentionSweep.ts` (runnable via `pnpm retention:sweep`, `scripts/retention-sweep.ts`) anonymizes patients past the configured window (`RETENTION_MONTHS`, default 24) that have no future appointments, reusing the `anonymizePatient` path with reason `retention`.
- **Audit**: three new actions (`patient.exported`, `patient.anonymized`, `retention.anonymized`) are recorded with counts only (never patient data).
- **No schema change**: Milestone 7 reused `Patient.anonymizedAt` / `deletedAt` and `ConsentRecord` from Milestone 1; no migration was required, and the `Appointment` schema was left untouched to keep future ICS calendar-invite support open.

## Testing (implementation status, Milestone 8)

The domain logic is covered by a [Vitest](https://vitest.dev) suite split into two
projects (see `DECISIONS.md`, Decision 012):

- **Unit** (`tests/unit/`) — pure logic with no I/O: Zod validation schemas,
  timezone/DST date math (`src/lib/date-time/*`), the availability interval
  helpers, CSV building (`src/lib/csv.ts`), and token/password hashing. These run
  anywhere, including in the pre-commit hook.
- **Integration** (`tests/integration/`) — the real server modules
  (`src/server/*`) against a real PostgreSQL database, so the
  `appointment_no_overlap` exclusion constraint, Prisma transactions, and
  clinic-scoping are exercised end to end rather than mocked. Shared
  `factories.ts` build clinics/doctors/patients/appointments, and each test
  resets the database.

Integration tests connect to a dedicated database derived from `DATABASE_URL`
(suffixed `_test`) or `TEST_DATABASE_URL`, created on first run with
`prisma migrate deploy`; they skip when no database is reachable (hard-fail under
`CI`). See `docs/07-runbook-dev-deploy.md` for commands and the local Postgres
(`docker-compose.yml`).



