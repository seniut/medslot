# 08 — Performance and Operations

## Expected data volume

For one doctor, database growth is small.

Example assumptions:

- 8 visits per day;
- 5 working days per week;
- 48 working weeks per year;
- about 1,920 appointments per year per doctor.

Even for 100 doctors:

- about 192,000 appointments per year.

This is small for PostgreSQL if indexes and queries are correct.

## Main tables that grow

- `Appointment`
- `Patient`
- `DoctorNote`
- `AuditLog`
- `ConsentRecord`

## Indexing strategy

MVP indexes:

```text
Appointment(clinicId, doctorId, startsAt)
Appointment(clinicId, patientId, startsAt)
Appointment(status)
Patient(clinicId, email)
Patient(clinicId, phone)
DoctorNote(clinicId, patientId)
AuditLog(clinicId, createdAt)
```

Add more only after observing query patterns.

## Query rules

Do not load all appointments without date range.

Bad:

```ts
findMany({ where: { doctorId } })
```

Good:

```ts
findMany({
  where: {
    doctorId,
    startsAt: { gte: rangeStart, lt: rangeEnd }
  }
})
```

Calendar queries must always use a date window.

## Public availability performance

Availability endpoint should query only:

- working hours;
- blocked times within selected range;
- booked appointments within selected range.

Do not query full patient details for public availability.

## Pagination

Use pagination for:

- patient list;
- audit logs;
- appointment history if large;
- export previews.

## CSV export

For MVP, direct CSV generation is fine.

For large exports later:

- stream CSV;
- create background export job;
- notify user when ready;
- store file temporarily with expiry.

## Database size management

Use three mechanisms:

1. retention/anonymization policy;
2. proper indexing;
3. backups and periodic maintenance.

## Retention and anonymization

See `docs/04-gdpr-rodo.md`.

For booking/admin data, implement configurable retention.

Do not delete formal medical documentation unless legally allowed.

## Backups

Minimum:

- managed daily backups;
- point-in-time recovery if provider supports it;
- documented restore procedure.

Test restore at least occasionally.

## Monitoring

Minimum:

- Vercel deployment/build logs;
- application error monitoring with Sentry;
- database provider metrics;
- email provider delivery logs.

Track:

- booking errors;
- cancellation errors;
- email send failures;
- database connection errors;
- slow queries;
- failed logins.

## Logging rules

Do not log:

- note content;
- patient message content;
- phone/email unless masked;
- raw tokens;
- secrets.

Log:

- appointment id;
- clinic id;
- doctor id;
- event type;
- status code;
- error code.

## Scaling path

### Stage 1 — one doctor / few doctors

Stack:

- Next.js on Vercel;
- managed Postgres;
- direct email provider.

No Redis or queue required.

### Stage 2 — dozens of doctors

Add:

- Sentry alerts;
- better DB metrics;
- connection pooling;
- background reminder jobs;
- more indexes if needed.

### Stage 3 — hundreds of doctors

Consider:

- background worker;
- queue for emails/SMS;
- read replicas if needed;
- tenant usage metrics;
- stricter rate limiting;
- billing service;
- audit log partitioning if needed.

## Performance anti-patterns

Avoid:

- calculating availability on the client;
- returning booked appointments with patient data to public page;
- loading entire appointment history for admin calendar;
- running exports on every page load;
- using Google Calendar as primary database;
- deleting appointment records;
- storing local-time strings as source of truth.

