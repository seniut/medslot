# 06 — Roadmap

## MVP: reliable calendar and visit history

### Must-have

- Public booking calendar.
- Available slots based on doctor working hours.
- Patient booking form.
- Confirmation page.
- Email confirmation.
- Secure cancellation link.
- Admin login.
- Admin calendar.
- Manual appointment creation.
- Appointment statuses.
- Patient visit history.
- Internal notes.
- Working hours settings.
- Blocked time.
- CSV export.
- Polish and English UI.
- Consent/privacy record.
- Audit log for key actions.
- Database no-overlap protection.

### Nice-to-have but still MVP-friendly

- Copy patient info to clipboard.
- Copy visit summary to clipboard.
- Basic patient search.
- Simple dashboard: today, upcoming, no-shows.

## Post-MVP 1: operational improvements

- SMS reminders.
- Email reminders 24h before visit.
- Reschedule link.
  - Admin-side reschedule (doctor moves an appointment) is shipped; patient self-service reschedule remains post-MVP.
- Doctor can define multiple appointment durations.
- Services list with price/duration.
- Better blocked time recurrence.
- Public holidays support.
- Calendar filters.
- Export by status.
- CSV import of patients.
- Audit log UI.

## Post-MVP 2: SaaS/productization

- Multi-doctor support.
- Multiple clinic locations.
- Clinic branding.
- Custom domain per clinic.
- Subscription billing.
- Role-based access: doctor/receptionist/admin.
- Tenant settings.
- Onboarding wizard.
- Invite staff.
- Admin analytics.
- Backoffice for product owner.

## Post-MVP 3: integrations

- Google Calendar sync.
- Outlook Calendar sync.
- Stripe payments.
- SMS provider integration.
- Webhooks.
- Zapier/Make integration.
- Import from CSV/Google Sheets.

## Post-MVP 4: compliance/hardening

- Advanced retention rules per clinic.
- Patient data export package.
- Patient erasure/anonymization workflow.
- Legal hold flag.
- Application-level encryption for notes.
- Two-factor authentication.
- Security event notifications.
- Session management UI.
- Subprocessor list UI/export.

## Post-MVP 5: optional medical documentation module

Do not start this until legal/technical review is complete.

Potential features:

- structured medical visit notes;
- document templates;
- immutable medical record entries;
- correction mechanism instead of delete/edit;
- long statutory retention;
- patient access/export;
- stronger audit trail;
- access logging;
- document PDF generation;
- role-based access;
- possible integration with existing medical documentation tools.

