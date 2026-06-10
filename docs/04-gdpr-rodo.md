# 04 — GDPR / RODO Requirements

> This document is not legal advice. Before selling the product commercially, review the privacy model with a Polish lawyer / GDPR specialist, especially if doctors use notes for health data or medical documentation.

## Context

This product processes personal data:

- first name;
- last name;
- phone number;
- email;
- appointment dates;
- cancellation/no-show/completed status;
- optional patient message;
- doctor notes.

If patient message or doctor notes contain information about symptoms, diagnosis, injury, treatment, pain, rehabilitation, medical history, etc., this becomes health data / special category data.

## Controller vs processor

For a SaaS model:

- doctor/clinic is usually the **data controller**;
- MedSlot operator is usually the **data processor**;
- subprocessors may include hosting/database/email providers.

Required commercial/legal documents:

- Privacy Policy for patient-facing page;
- Data Processing Agreement / Umowa powierzenia przetwarzania danych osobowych with the doctor/clinic;
- list of subprocessors;
- data retention policy;
- incident/breach procedure;
- terms of service.

## MVP privacy positioning

For MVP, position the system as:

- appointment booking calendar;
- patient contact database;
- visit history;
- internal administrative notes.

Do not position MVP as:

- electronic medical documentation system;
- diagnostic system;
- treatment record system;
- healthcare records platform.

## UI warnings for notes

In admin notes UI, show:

```text
Notatka wewnętrzna. Nie używaj tego pola jako pełnej dokumentacji medycznej, jeśli system nie został skonfigurowany i zweryfikowany do prowadzenia dokumentacji medycznej.
```

English:

```text
Internal note. Do not use this field as full medical documentation unless the system has been configured and legally reviewed for medical records processing.
```

## Legal basis — implementation note

Do not blindly rely on consent for everything.

A GDPR specialist should define lawful bases for:

- booking/contact processing;
- appointment confirmation;
- cancellation handling;
- internal records;
- medical/health data if applicable;
- marketing communication if added later.

In the application, store what the patient accepted and which privacy text version was shown.

## Consent / privacy record

For every public booking, store:

- patient id;
- appointment id;
- privacy text version;
- timestamp;
- optional hashed IP;
- optional hashed user-agent.

Do not store raw IP/user-agent unless there is a clear reason.

### Implementation status (Milestone 2)

The public booking flow implements this section as specified:

- Each booking writes a `ConsentRecord` (patient id, appointment id, consent `type` `booking_privacy`, privacy `textVersion`, `acceptedAt`) atomically in the booking transaction.
- IP address and user-agent are stored only as SHA-256 hashes (`ipAddressHash`, `userAgentHash`) and only when present; raw values are never persisted or logged.
- The privacy text version is centralized in `src/lib/booking-config.ts` (`PRIVACY_TEXT_VERSION`).
- The cancellation token is emailed once; only its SHA-256 hash is stored on the appointment.
- Public availability and confirmation pages select no patient fields, so no patient data is exposed on public routes.
- The patient form collects only first name, last name, phone, email, and an optional message shown with a warning against sensitive medical detail — matching the data-minimization list below.
- On a successful public booking the doctor/clinic (the data controller) receives an internal notification email containing the patient's name, phone, email, and optional message so staff can act on the booking. The recipient is `DOCTOR_NOTIFICATION_EMAIL` (or the doctor's own email when unset) — never another patient — and the email adapter logs no recipients or contents.

### Implementation status (Milestone 3)

The cancellation flow implements this section as specified:

- The cancel page (`/[locale]/cancel/[token]`) resolves appointments only by the SHA-256 hash of the emailed token; the raw token is never stored or logged.
- The page selects no patient fields and exposes only the appointment date/time, asks for confirmation, and offers a re-book link.
- Cancellation is a soft status change to `cancelled_by_patient` (with `cancelledAt`); the appointment is never deleted, preserving visit history.
- The cancellation is audited (`appointment.cancelled_by_patient`, actor `patient`, no PII in metadata), and invalid / expired / already-cancelled tokens fail safely without revealing whether a token existed.

### Implementation status (Milestone 4)

The admin area implements the access-control and audit expectations for staff:

- Admin authentication is implemented (`AdminUser` + signed-cookie session); passwords are stored only as `scrypt` hashes. Every protected admin page and server action enforces the session, and all admin queries are scoped by `clinicId`. See `DECISIONS.md`, Decision 009.
- Patient names and contact details are shown only inside the authenticated admin area, never on public routes.
- All sensitive admin actions are audited with the acting admin user id and no PII in metadata: `appointment.created_manual`, `appointment.completed`, `appointment.no_show`, and `appointment.cancelled_by_doctor`.
- Manual appointment creation reuses the same database-level overlap protection as public booking, so admin entry cannot create double bookings.
- The manual-appointment form keeps the same data-minimization fields and renders the internal-note warning against storing full medical documentation.
- A manual entry emails the patient a confirmation only when the admin opts in (the "email the patient" checkbox, available only when an email is on file). When enabled, a one-time cancellation token is generated so the patient can self-cancel; only its SHA-256 hash is stored, never the raw token. No marketing consent is involved — this is a transactional appointment confirmation.

### Implementation status (Milestone 7)

The data-subject-rights, retention, and privacy-page expectations are implemented for the MVP:

- **Privacy policy page** — a public, patient-facing page at `/[locale]/privacy` renders in Polish and English from the `privacy` i18n namespace and shows the active `PRIVACY_TEXT_VERSION` as its version. It is linked from the booking consent block and the home page. It contains no patient data. The clinic (controller) must finalize controller-specific details (identity, contact, supervisory authority).
- **Access / portability** — admins can export a single patient's full record (profile, appointments, notes, consent records) as a JSON attachment via `/api/admin/patients/[id]/export` (`src/server/patients/exportPatientData.ts`). The export is admin-only, clinic-scoped, and audited (`patient.exported`, counts only).
- **Erasure / anonymization** — admins can anonymize a patient from the detail page (`src/server/patients/anonymizePatient.ts`). This redacts name and contact fields to neutral placeholders, sets `anonymizedAt`, clears free-text patient messages, and deletes internal notes, while keeping the appointments (date/time/status) so business and aggregate history survive. It refuses to run while the patient has a future `booked` appointment, is idempotent, and is audited (`patient.anonymized`, counts only). The record stays listable with an "Anonymized" badge (`deletedAt` is left null for a possible future hard-removal flow).
- **Retention** — a configurable sweep (`src/server/retention/retentionSweep.ts`, runnable via `pnpm retention:sweep`) anonymizes patients whose most recent appointment predates the retention window and who have no future appointments. The window is `RETENTION_MONTHS` (default 24); see the retention mechanism section below.
- **Audit** — three new actions were added (`patient.exported`, `patient.anonymized`, `retention.anonymized`); audit metadata holds only counts, never patient data.
- **Consent** capture/versioning (Milestone 2) and the **notes warning** (Milestone 6) remain in place and are reused here.

## Data minimization

MVP patient form should collect only:

- first name;
- last name;
- phone;
- email.

Optional message should be clearly optional and should discourage detailed medical data.

Avoid collecting:

- PESEL;
- address;
- ID card/passport number;
- detailed health history;
- attachments;
- photos;
- scans;
- birth date;
- unnecessary demographic details.

## Data subject rights support

The product should support these operational flows:

### Access request

Admin can export patient data:

- patient profile;
- appointments;
- notes;
- consent records.

### Rectification request

Admin can correct patient contact data.

### Erasure request

If legal basis allows erasure, admin can delete/anonymize patient data.

If data must be retained for legal reasons, do not delete; restrict processing or document refusal reason.

### Restriction of processing

Post-MVP: add patient flag:

- `processingRestrictedAt`
- `processingRestrictionReason`

### Portability

CSV/JSON export should be possible.

## Retention policy

### Important distinction

There are two different categories:

1. **Booking/admin data** — appointment calendar and contact management.
2. **Medical documentation** — formal health records.

For MVP, treat data as booking/admin data unless the customer explicitly uses notes as medical documentation.

### Suggested configurable retention for booking/admin data

Default suggestion:

- keep active patient records while there is ongoing relationship;
- keep completed/cancelled/no-show visit history for 24 months after the last appointment;
- anonymize patient contact fields after retention expires;
- keep aggregate appointment history without direct identifiers if needed.

This is a product default, not a legal rule. The controller must configure according to their legal basis and business need.

### If medical documentation is stored

Do not use simple 24-month deletion rules.

Medical documentation in Poland generally has long statutory retention periods and specific access/destruction rules. Treat this as a separate product module requiring legal review.

## Data retention mechanism

Add a future scheduled job:

```text
retentionSweep()
```

Steps:

1. Find patients whose last appointment is older than configured retention.
2. Exclude patients with active future bookings.
3. Exclude patients with legal hold/restriction flag.
4. Export or log summary if required.
5. Anonymize personal fields.
6. Record audit log.

Suggested fields:

```text
Patient.deletedAt
Patient.anonymizedAt
Patient.retentionHoldUntil
Patient.retentionHoldReason
```

### Implemented (Milestone 7)

`retentionSweep()` is implemented in `src/server/retention/retentionSweep.ts`
and runnable via `pnpm retention:sweep` (`scripts/retention-sweep.ts`), intended
to run on a schedule (e.g. a cron job):

- The retention window is configured by `RETENTION_MONTHS` (default 24) in
  `src/lib/retention-config.ts`; the cutoff is `now - RETENTION_MONTHS months`.
- A patient is anonymized only when not already anonymized, not soft-deleted, has
  at least one appointment, has **no** future appointment of any status, and
  their most recent appointment ended before the cutoff.
- Each eligible patient is anonymized through the same `anonymizePatient()` path
  (reason `retention`, audit action `retention.anonymized`), reusing its guards.
- The sweep prints only aggregate counts (`scanned`, `anonymized`, `skipped`)
  and is idempotent.
- `Patient.retentionHoldUntil` / `retentionHoldReason` (legal-hold/restriction
  flags) remain a documented post-MVP addition; today the sweep relies on the
  "no future appointment" exclusion and `anonymizedAt`.

## Audit logging

Log these actions:

- public appointment created;
- manual appointment created;
- appointment cancelled by patient;
- appointment cancelled by doctor;
- appointment rescheduled;
- appointment completed;
- no-show marked;
- note created/updated/deleted;
- patient exported;
- appointments CSV exported;
- working hours changed;
- retention/anonymization executed.

Audit logs must avoid sensitive content. Store event metadata, not note text.

## Security requirements

### Access control

- Admin pages require authentication.
- Public pages cannot return patient data.
- All admin mutations check current clinic/doctor scope.

### Secrets

Never commit secrets.

Use environment variables for:

- database URL;
- auth secret;
- email provider key;
- cancellation token secret;
- Sentry DSN.

### Cancellation tokens

- Generate secure random token.
- Send raw token only by email link.
- Store only hash in database.
- Token should be single-purpose.

### Encryption

Minimum:

- HTTPS;
- database encryption at rest through managed provider;
- encrypted backups through provider;
- environment variable secrets.

Recommended for notes:

- application-level encryption for note content if notes may include sensitive data.

### Backups

- Use managed Postgres backups.
- Test restore procedure.
- Define backup retention.

### Breach response

Document:

- who investigates;
- how logs are collected;
- how affected controller/customer is notified;
- how incident timeline is recorded;
- how credentials are rotated.

## Cookie/analytics rules

Avoid non-essential cookies and tracking in MVP.

If analytics are added:

- prefer privacy-friendly analytics;
- update cookie/privacy policy;
- add consent banner if legally required.

## Privacy pages to add

Add public pages:

- `/privacy` or `/polityka-prywatnosci`;
- `/terms` optional;
- `/data-processing` optional for B2B.

> Implemented (Milestone 7): the `/privacy` page exists at `/[locale]/privacy`
> (`/pl/privacy`, `/en/privacy`). Localized pathnames (e.g.
> `/polityka-prywatnosci`) remain a possible future enhancement. `/terms` and
> `/data-processing` are still optional/post-MVP.

## Privacy text versioning

Store privacy policy version in code/config:

```text
PRIVACY_POLICY_VERSION=2026-06-01
```

Each booking stores this version in `ConsentRecord`.

When privacy text changes:

1. Update privacy page.
2. Update version.
3. Update docs.
4. Update changelog.

## Development checklist

Before production:

- [x] Privacy Policy prepared. _(Page implemented at `/[locale]/privacy`; clinic finalizes controller-specific legal details.)_
- [ ] DPA template prepared.
- [ ] Subprocessor list prepared.
- [x] Consent checkbox implemented.
- [x] Consent version stored.
- [x] Admin auth implemented.
- [x] Public pages do not expose patient data.
- [x] Audit logs implemented.
- [x] Export flow implemented.
- [x] Retention policy documented.
- [ ] Backups enabled.
- [ ] Sentry/logging configured without sensitive data.
- [x] Notes warning implemented.
- [ ] Legal review completed before commercial launch.

## References to verify during implementation

- GDPR Article 9 — special categories of personal data.
- European Commission data subject rights guidance.
- UODO guidance and updates.
- KIF guidance on physiotherapist medical documentation.
- Polish patient rights / medical documentation retention rules if the system handles formal medical documentation.

