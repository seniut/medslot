# 03 — Data Model

## Principles

1. PostgreSQL is the source of truth.
2. Appointments are never physically deleted during normal operations.
3. Cancelled appointments remain in history.
4. Only active `booked` appointments block future availability.
5. Double-booking must be prevented at the database level.
6. Patient-facing availability must not expose patient data.
7. Add `clinicId` and `doctorId` from the start even if the first customer is one doctor.

## Entities

### Clinic

Represents a tenant/customer.

Fields:

- `id`
- `name`
- `slug`
- `defaultLocale`
- `timezone`
- `createdAt`
- `updatedAt`

### Doctor

Represents the healthcare professional.

Fields:

- `id`
- `clinicId`
- `displayName`
- `email`
- `phone`
- `timezone`
- `createdAt`
- `updatedAt`

### AdminUser

Represents a user who can log into admin.

Fields:

- `id`
- `clinicId`
- `doctorId` nullable
- `email`
- `passwordHash` (scrypt hash; never the raw password)
- `role`
- `createdAt`
- `updatedAt`

Roles for MVP:

- `owner`
- `doctor`

Later:

- `receptionist`
- `admin`

### Patient

Represents a patient/contact.

Fields:

- `id`
- `clinicId`
- `firstName`
- `lastName`
- `phone`
- `email`
- `createdAt`
- `updatedAt`
- `deletedAt` nullable
- `anonymizedAt` nullable

Rules:

- Do not create duplicates if phone/email matches existing patient inside the same clinic.
- Store as little data as needed.

### Appointment

Represents a visit booking.

Fields:

- `id`
- `clinicId`
- `doctorId`
- `patientId`
- `startsAt`
- `endsAt`
- `status`
- `source`
- `patientMessage`
- `cancelTokenHash`
- `createdAt`
- `updatedAt`
- `cancelledAt`
- `completedAt`

Statuses:

- `booked`
- `completed`
- `cancelled_by_patient`
- `cancelled_by_doctor`
- `no_show`

Sources:

- `public_booking`
- `manual_admin`

### DoctorNote

Internal note.

Fields:

- `id`
- `clinicId`
- `doctorId`
- `patientId`
- `appointmentId` nullable
- `content`
- `createdAt`
- `updatedAt`

Important:

- In MVP, this is an internal note field.
- UI must warn not to use it as full medical documentation.
- Consider encryption for this field.
- Implemented in Milestone 6: notes are created from the admin patient detail and appointment detail pages (a patient note has no `appointmentId`; an appointment note links to one). Creation is clinic-scoped and audited (`note.created`); note content is never written to the audit log.

### WorkingHour

Regular weekly availability.

Fields:

- `id`
- `clinicId`
- `doctorId`
- `dayOfWeek`
- `startTime`
- `endTime`
- `isActive`
- `createdAt`
- `updatedAt`

`dayOfWeek` convention:

- 1 = Monday;
- 2 = Tuesday;
- 3 = Wednesday;
- 4 = Thursday;
- 5 = Friday;
- 6 = Saturday;
- 7 = Sunday.

As of Milestone 5, working hours are managed through the admin Availability page
(`/[locale]/admin/settings`). The editor stores exactly one row per weekday
(replace-all on save); inactive days are kept with `isActive = false` so their
times persist but produce no bookable slots.

### BlockedTime

Manual unavailable interval.

Fields:

- `id`
- `clinicId`
- `doctorId`
- `startsAt`
- `endsAt`
- `reason`
- `createdAt`
- `updatedAt`

As of Milestone 5, blocked time is created and removed from the admin
Availability page. `startsAt` / `endsAt` are stored as absolute UTC instants
derived from a calendar date plus start/end wall-clock times in the clinic
timezone; `reason` is optional internal free text and is never written to the
audit log.

### ConsentRecord

Records privacy/data processing acceptance.

Fields:

- `id`
- `clinicId`
- `patientId`
- `appointmentId`
- `type`
- `textVersion`
- `acceptedAt`
- `ipAddressHash` optional
- `userAgentHash` optional

Do not store raw IP/user-agent unless necessary. Hashing can reduce risk.

### AuditLog

Records important actions.

Fields:

- `id`
- `clinicId`
- `actorType`
- `actorUserId` nullable
- `action`
- `entityType`
- `entityId`
- `metadata`
- `createdAt`

Actions:

- `appointment.created_public`
- `appointment.created_manual`
- `appointment.cancelled_by_patient`
- `appointment.cancelled_by_doctor`
- `appointment.completed`
- `appointment.no_show`
- `note.created`
- `note.updated`
- `export.appointments_csv`
- `working_hours.updated`
- `blocked_time.created`
- `blocked_time.deleted`

## Prisma schema draft

```prisma
model Clinic {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique
  defaultLocale String   @default("pl")
  timezone      String   @default("Europe/Warsaw")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  doctors       Doctor[]
  patients      Patient[]
  appointments  Appointment[]
}

model Doctor {
  id          String   @id @default(cuid())
  clinicId    String
  displayName String
  email       String
  phone       String?
  timezone    String   @default("Europe/Warsaw")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  clinic       Clinic        @relation(fields: [clinicId], references: [id])
  appointments Appointment[]
  workingHours WorkingHour[]
  blockedTimes BlockedTime[]
}

model Patient {
  id           String    @id @default(cuid())
  clinicId     String
  firstName    String
  lastName     String
  phone        String
  email        String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime?
  anonymizedAt DateTime?

  clinic        Clinic        @relation(fields: [clinicId], references: [id])
  appointments  Appointment[]
  notes         DoctorNote[]

  @@index([clinicId, email])
  @@index([clinicId, phone])
}

enum AppointmentStatus {
  booked
  completed
  cancelled_by_patient
  cancelled_by_doctor
  no_show
}

enum AppointmentSource {
  public_booking
  manual_admin
}

model Appointment {
  id              String            @id @default(cuid())
  clinicId        String
  doctorId        String
  patientId       String
  startsAt        DateTime
  endsAt          DateTime
  status          AppointmentStatus @default(booked)
  source          AppointmentSource @default(public_booking)
  patientMessage  String?
  cancelTokenHash String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  cancelledAt     DateTime?
  completedAt     DateTime?

  clinic          Clinic            @relation(fields: [clinicId], references: [id])
  doctor          Doctor            @relation(fields: [doctorId], references: [id])
  patient         Patient           @relation(fields: [patientId], references: [id])
  notes           DoctorNote[]
  consents        ConsentRecord[]

  @@index([clinicId, doctorId, startsAt])
  @@index([clinicId, patientId, startsAt])
  @@index([status])
}

model DoctorNote {
  id            String   @id @default(cuid())
  clinicId      String
  doctorId      String
  patientId     String
  appointmentId String?
  content       String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  patient       Patient      @relation(fields: [patientId], references: [id])
  appointment   Appointment? @relation(fields: [appointmentId], references: [id])

  @@index([clinicId, patientId])
  @@index([clinicId, appointmentId])
}

model WorkingHour {
  id        String   @id @default(cuid())
  clinicId  String
  doctorId  String
  dayOfWeek Int
  startTime String
  endTime   String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  doctor    Doctor   @relation(fields: [doctorId], references: [id])

  @@index([clinicId, doctorId, dayOfWeek])
}

model BlockedTime {
  id        String   @id @default(cuid())
  clinicId  String
  doctorId  String
  startsAt  DateTime
  endsAt    DateTime
  reason    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  doctor    Doctor   @relation(fields: [doctorId], references: [id])

  @@index([clinicId, doctorId, startsAt])
}

model ConsentRecord {
  id             String   @id @default(cuid())
  clinicId       String
  patientId      String
  appointmentId  String
  type           String
  textVersion    String
  acceptedAt     DateTime @default(now())
  ipAddressHash  String?
  userAgentHash  String?

  appointment    Appointment @relation(fields: [appointmentId], references: [id])

  @@index([clinicId, patientId])
  @@index([clinicId, appointmentId])
}

model AuditLog {
  id          String   @id @default(cuid())
  clinicId    String
  actorType   String
  actorUserId String?
  action      String
  entityType  String
  entityId    String
  metadata    Json?
  createdAt   DateTime @default(now())

  @@index([clinicId, createdAt])
  @@index([clinicId, entityType, entityId])
}
```

## PostgreSQL double-booking protection

Prisma does not model PostgreSQL exclusion constraints directly in a simple way. Add a raw SQL migration.

Concept:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
ADD CONSTRAINT appointment_no_overlap
EXCLUDE USING gist (
  "doctorId" WITH =,
  tstzrange("startsAt", "endsAt", '[)') WITH &&
)
WHERE (status = 'booked');
```

Meaning:

For one doctor, there cannot be two active booked appointments with overlapping time intervals.

This is stronger than `UNIQUE(doctorId, startsAt)` because appointments can have different durations.

## Retention/anonymization design

Add configurable retention settings later:

- `bookingRetentionMonths`
- `cancelledBookingRetentionMonths`
- `noShowRetentionMonths`
- `noteRetentionMonths`

MVP default suggestion for non-medical booking data:

- keep appointment and contact history for 24 months after the last visit unless the controller configures a different rule;
- allow admin export before deletion/anonymization;
- anonymize patient contact fields when retention expires, rather than deleting business history.

If the system is used as medical documentation, do not use this retention suggestion. Medical documentation has statutory retention rules and requires legal review.

## Anonymization approach

When anonymizing a patient:

- replace first name with `Anonymized`;
- replace last name with `Patient`;
- replace phone with empty or hash;
- replace email with empty or hash;
- keep appointment timestamps/statuses for aggregate reporting;
- remove or encrypt/anonymize notes depending on policy;
- set `anonymizedAt`.

### Implemented (Milestone 7)

`src/server/patients/anonymizePatient.ts` implements this approach:

- `firstName` → `Anonymized`, `lastName` → `Patient`, `phone` → empty, `email` →
  empty (placeholders in `src/lib/retention-config.ts`); `anonymizedAt` is set.
- Appointments are kept (date/time/status/source); their free-text
  `patientMessage` values are cleared, and the patient's `DoctorNote` rows are
  deleted. All changes run in one transaction.
- `deletedAt` is intentionally left null so the redacted record stays listable as
  "Anonymized"; a future hard-removal flow may use `deletedAt`.
- The operation refuses to run while the patient has a future `booked`
  appointment, is idempotent (a second attempt is rejected), and is audited
  (`patient.anonymized` for manual, `retention.anonymized` for the sweep) with
  counts only. The same path is reused by the retention sweep
  (`src/server/retention/retentionSweep.ts`, `RETENTION_MONTHS`, default 24).

## Implementation status (Milestone 1)

The schema in this document is implemented in `prisma/schema.prisma` with these notes:

- All nine models and both enums (`AppointmentStatus`, `AppointmentSource`) are implemented as drafted. `AdminUser` was added in Milestone 4 (admin authentication) with an additional `passwordHash` field (scrypt) and an `@@index([clinicId])`; `role` is stored as an open string (defaulting to `owner`) rather than an enum so new roles can be added without a migration.
- Migrations live in `prisma/migrations/`:
  - `*_init` — tables, enums, indexes, and foreign keys.
  - `*_appointment_no_overlap` — `CREATE EXTENSION btree_gist` plus the exclusion constraint.
  - `*_add_admin_user` — the `AdminUser` table (Milestone 4).
- The no-overlap constraint uses `tsrange` rather than the `tstzrange` shown in the concept above, because Prisma maps `DateTime` to `timestamp(3)` (UTC, without time zone). See `DECISIONS.md`, Decision 008. Overlap detection stays timezone-independent because stored values are UTC.
- `Doctor` has an added `@@index([clinicId])` for clinic-scoped lookups; this is the only addition beyond the draft.
- A seed (`prisma/seed.ts`) creates one clinic and one doctor and is idempotent. Clinic/doctor details, the default locale, and the admin credentials are env-driven (with demo defaults), so the same script seeds a real single-doctor deployment; it is keyed by `CLINIC_SLUG` and `DOCTOR_EMAIL`.
- Milestone 5 (working hours and blocked time) added no schema change or migration: it reused the existing `WorkingHour` and `BlockedTime` models, now managed through the admin Availability page.
- Milestone 6 (patient history, internal notes, CSV export) added no schema change or migration: it reused the existing `DoctorNote` model, now managed through the admin patient and appointment detail pages, and reads patient/appointment data for the patient list and CSV export.
- Milestone 7 (GDPR/RODO hardening) added no schema change or migration: it reused `Patient.anonymizedAt` / `deletedAt` and `ConsentRecord` for anonymization, export, and the retention sweep, and deliberately left the `Appointment` model untouched to keep future ICS support open.
- Because the development environment had no local PostgreSQL, the migrations were generated with `prisma migrate diff` (no database connection) and validated via `prisma validate` + `prisma generate`. Apply them with `prisma migrate deploy` (or `migrate dev`) once a `DATABASE_URL` is available.

