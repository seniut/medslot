# 01 — Product Specification

## Product name

Working name: **MedSlot**.

This is a neutral internal name. Before commercial use, check:

- trademark conflicts;
- domain availability;
- Polish/English pronunciation;
- whether the name sounds too medical if the first MVP is only a booking calendar.

Alternative names:

- VisitSlot
- CareSlot
- ClinicSlot
- FizjoSlot
- ProVisit Calendar
- BookMed Calendar

## Product one-liner

**MedSlot is a simple online appointment calendar for healthcare professionals. Patients book and cancel visits online; the doctor manages appointments, patient history, notes, and exports from an admin calendar.**

## Target users

### Primary user

A doctor/physiotherapist/specialist who needs:

- simple online booking;
- calendar visibility;
- patient contact history;
- less manual scheduling through phone/Instagram/Messenger;
- a lightweight replacement for manual calendar/spreadsheet usage.

### Secondary user

Patient who needs:

- fast visit booking;
- clear available times;
- no account creation;
- cancellation link.

## MVP goals

1. Let a patient book a visit from a public page.
2. Let a patient cancel a visit via secure link.
3. Let a doctor see booked patients in an admin calendar.
4. Let a doctor create manual appointments.
5. Let a doctor configure working days/hours.
6. Let a doctor add internal notes.
7. Let a doctor see visit history and export it.
8. Support Polish and English UI.
9. Store consent and privacy policy version accepted by the patient.
10. Prevent double-booking reliably.

## Non-goals for MVP

Do not build these in the first version:

- full marketplace;
- reviews/ratings;
- patient accounts;
- mobile app;
- payment integration;
- SMS reminders;
- full electronic medical documentation;
- AI-generated medical notes;
- insurance/NFZ integrations;
- multiple clinics with billing;
- advanced analytics.

## Patient-facing requirements

### Booking page

The patient must be able to:

- choose locale: Polish or English;
- see available dates;
- see available time slots;
- enter personal/contact details;
- accept privacy/data processing information;
- submit booking;
- see confirmation.

Patient form fields:

- first name — required;
- last name — required;
- phone — required;
- email — required;
- optional message — optional, with warning not to enter detailed medical documentation;
- privacy acceptance checkbox — required.

### Public visibility rule

The patient must never see:

- other patient names;
- other patient phone numbers;
- other patient emails;
- doctor notes;
- appointment history of other patients.

Recommended patient view:

- show only free slots;
- optionally show unavailable days, but without patient details.

### Cancellation flow

The patient receives a cancellation link in the confirmation email.

The link must use a secure random token.

The database stores only the token hash.

Cancellation page must:

- show appointment date/time;
- not expose unnecessary personal data;
- ask for confirmation;
- change appointment status to `cancelled_by_patient`;
- not delete the appointment record.

## Admin requirements

### Admin login

Only authenticated doctor/admin users can access `/admin`.

### Calendar

The admin calendar must show:

- day view;
- week view;
- month view eventually, optional in MVP;
- patient full name;
- appointment status;
- blocked time;
- manual appointments.

### Appointment details

The doctor must see:

- patient first name;
- patient last name;
- phone;
- email;
- appointment date and time;
- status;
- optional patient message;
- internal notes;
- history link.

Actions:

- mark completed;
- mark no-show;
- cancel appointment;
- edit basic appointment data;
- copy visit summary;
- add note.

### Manual appointment creation

Doctor can add an appointment manually when a patient books by phone, Instagram, WhatsApp, or in person.

Manual appointment form:

- date;
- time;
- first name;
- last name;
- phone;
- email optional but recommended;
- optional note.

Manual appointments must use the same double-booking protection as public bookings.

### Working hours

Doctor can define working days and hours.

MVP model:

- weekday;
- start time;
- end time;
- active/inactive.

Example:

- Monday: 09:00–17:00;
- Tuesday: 12:00–20:00;
- Wednesday: off.

The patient-facing availability must be calculated from these settings.

### Blocked time

Doctor can block time manually for:

- breaks;
- vacation;
- training;
- private appointment;
- illness;
- other reason.

Blocked time is visible to admin and unavailable to patients.

### History

The doctor must see patient visit history:

- booked;
- completed;
- cancelled by patient;
- cancelled by doctor;
- no-show.

Cancelled appointments must remain visible in history.

### Notes

The doctor can add internal notes.

UI warning:

> This is an internal note field. Do not use it as full medical documentation unless the system has been configured and legally reviewed for medical records processing.

### Export and copy

Doctor can:

- copy patient details;
- copy visit summary;
- export visits as CSV by date range.

CSV columns:

- appointment date;
- start time;
- end time;
- patient first name;
- patient last name;
- phone;
- email;
- status;
- notes summary optional;
- source: public/manual.

## Appointment statuses

Use these statuses:

- `booked` — active booking;
- `completed` — patient came and visit happened;
- `cancelled_by_patient` — patient cancelled;
- `cancelled_by_doctor` — doctor/admin cancelled;
- `no_show` — patient did not come.

Rules:

- Only `booked` appointments block future availability.
- Cancelled future appointments release the slot.
- Completed/no-show are historical states.
- Do not physically delete appointments for normal business actions.

## Availability rules

Availability is calculated from:

1. doctor working hours;
2. blocked time;
3. existing booked appointments;
4. appointment duration;
5. slot step;
6. minimum booking notice;
7. maximum booking window.

MVP defaults:

- appointment duration: 60 minutes;
- slot step: 30 minutes;
- minimum booking notice: 4 hours;
- booking window: 30 days ahead;
- timezone: Europe/Warsaw.

## Acceptance criteria for MVP

MVP is acceptable when:

- patient can book a visit;
- patient can cancel a visit;
- doctor can log in;
- doctor sees appointments in calendar;
- doctor sees patient data;
- doctor can add manual appointments;
- doctor can change working hours;
- patient availability changes after working hours update;
- double-booking is impossible;
- doctor can add notes;
- doctor can export CSV;
- Polish and English UI work;
- privacy/consent record is stored;
- deployment works on Vercel;
- database migrations are reproducible.

