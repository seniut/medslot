# 10 — Feature Backlog

## MVP features

- Public booking calendar.
- Admin calendar.
- Patient self-cancellation.
- Manual appointment creation.
- Working hours configuration.
- Blocked time.
- Patient history.
- Internal notes.
- Copy patient/visit summary.
- CSV export.
- Polish/English UI.
- Privacy consent record.
- Audit logs.

## Strong post-MVP features

### SMS reminders

Send SMS reminder 24h before appointment.

Value:

- fewer no-shows;
- more professional experience.

### Email reminders

Send email reminder 24h before visit.

Lower cost than SMS.

### Reschedule link

Patient can move appointment instead of cancelling.

### Service types

Doctor can configure:

- consultation;
- therapy;
- check-up;
- sports physiotherapy;
- custom service.

Each service has:

- duration;
- price;
- description;
- active/inactive.

### Payment deposit

Allow partial prepayment/deposit.

Value:

- fewer no-shows.

### Google Calendar sync

Sync appointments to doctor's Google Calendar.

Important:

- PostgreSQL remains source of truth.
- Google Calendar is only an integration target.

### Multi-doctor support

One clinic with multiple doctors.

Needs:

- doctor selection on public page;
- per-doctor working hours;
- admin role scoping.

### Custom branding

Per-clinic:

- logo;
- color theme;
- public page text;
- address;
- contact info;
- domain.

### No-show analytics

Dashboard:

- bookings per week;
- cancellations;
- no-shows;
- completed appointments;
- busiest days/hours.

### Waiting list

Patient can join waiting list if no slot is available.

### Patient import

CSV import from existing spreadsheet.

### Patient export package

Export all data for one patient:

- profile;
- appointments;
- notes;
- consents;
- audit summary.

### Better retention module

Admin can configure retention/anonymization rules.

### 2FA for admin

Add two-factor authentication for admin users.

### Medical documentation module

Only after legal/technical design review.

Possible scope:

- structured visit records;
- immutable records;
- correction workflow;
- statutory retention;
- patient access/export;
- stronger audit logs;
- access logs;
- PDF records.

## Features to avoid early

- marketplace;
- public reviews;
- complex SEO directory;
- mobile app;
- AI medical notes;
- insurance integrations;
- large analytics platform;
- multi-country legal complexity.

