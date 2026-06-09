# 09 — AI Workflow Prompts for VS Code Copilot and Codex

This document contains copy-paste prompts to continue development directly in VS Code/Codex.

## How to use this file

1. Copy the relevant prompt.
2. Paste it into GitHub Copilot Chat or Codex.
3. Ask the agent to read repository files first.
4. Ask for a plan before implementation for larger tasks.
5. Require docs/changelog updates in the same change.
6. Run validation commands after implementation.

## General instruction for every AI coding session

Use this at the start of a new chat:

```text
You are working on the MedSlot project: a Next.js + TypeScript + PostgreSQL + Prisma appointment calendar for healthcare professionals.

Before changing code, read:
- README.md
- AGENTS.md
- .github/copilot-instructions.md
- PLANS.md
- DECISIONS.md
- docs/01-product-spec.md
- docs/02-architecture.md
- docs/03-data-model.md
- docs/04-gdpr-rodo.md

Follow the project rules:
- Keep the MVP focused on booking calendar, admin calendar, patient history, internal notes, manual booking, cancellation, working hours, CSV export, Polish/English UI.
- Do not build a full medical documentation system unless explicitly requested.
- Do not expose patient data in public pages.
- All booking creation paths must use the same server-side validation and double-booking protection.
- All user-facing text must be localizable in Polish and English.
- Every feature must update relevant docs, PLANS.md, CHANGELOG.md, and DECISIONS.md when needed.

First summarize your understanding of the current repo structure and propose a step-by-step implementation plan. Do not modify code until the plan is clear.
```

## Prompt: bootstrap project structure

```text
Implement Milestone 0 from PLANS.md.

Tasks:
- Verify the Next.js App Router project structure.
- Create the documented folder structure under src/.
- Add placeholder i18n message files for pl and en.
- Add basic layout with locale routing if not present.
- Add .env.example if missing.
- Add or update package scripts for dev, build, lint, typecheck, prisma commands, and check.

Constraints:
- Do not implement business logic yet.
- Keep changes scoped.
- Update README.md and CHANGELOG.md.
- Run pnpm check or explain if a command cannot run.
```

## Prompt: implement database schema

```text
Implement Milestone 1 from PLANS.md.

Use Prisma and PostgreSQL.

Tasks:
- Add models from docs/03-data-model.md.
- Add AppointmentStatus and AppointmentSource enums.
- Add indexes needed for calendar and patient history.
- Create initial migration.
- Add raw SQL migration for appointment no-overlap constraint using PostgreSQL exclusion constraint.
- Add seed script with one clinic and one doctor.

Rules:
- Do not use db push for production workflow.
- Create migrations only.
- Document every schema decision in DECISIONS.md if changed.
- Update docs/03-data-model.md if implementation differs from the draft.
- Update CHANGELOG.md.
- Run prisma generate and migration validation.
```

## Prompt: implement public booking flow

```text
Implement Milestone 2: public booking flow.

Tasks:
- Create /[locale]/booking page.
- Implement available slot calculation using working hours, blocked times, booked appointments, slot step, duration, minimum booking notice, and maximum booking window.
- Implement BookingForm with Zod validation.
- Implement createAppointment server action/service.
- Find or create patient by clinic + email/phone.
- Store consent record with privacy policy version.
- Create audit log entry.
- Generate secure cancellation token, store only hash.
- Send booking confirmation email through email adapter.

Rules:
- Public UI must never expose patient data.
- Recheck availability server-side before creation.
- Rely on DB no-overlap constraint to prevent race conditions.
- All UI strings must be in pl/en dictionaries.
- Update docs and changelog.
- Add tests or at least document manual test steps.
```

## Prompt: implement cancellation flow

```text
Implement Milestone 3: patient cancellation by secure link.

Tasks:
- Add /[locale]/cancel/[token] page.
- Hash incoming token and find appointment by token hash.
- Show minimal appointment information.
- Add confirmation action to cancel.
- Set status to cancelled_by_patient and cancelledAt.
- Do not delete appointment.
- Add audit log.
- Send cancellation confirmation email and doctor notification.

Rules:
- Invalid/expired token must fail safely.
- Cancelled future slot must become bookable again.
- All messages must be localized.
- Update docs and changelog.
```

## Prompt: implement admin calendar

```text
Implement Milestone 4: admin authentication and calendar.

Tasks:
- Protect /[locale]/admin routes.
- Add admin calendar page using FullCalendar or simple day/week view.
- Show booked appointments with patient names to authenticated admin only.
- Add appointment details panel/page.
- Add actions: mark completed, mark no-show, cancel by doctor.
- Add manual appointment creation form.

Rules:
- Manual appointment creation must reuse the same overlap protection as public booking.
- All admin mutations must verify authenticated admin and clinic scope.
- Public pages must remain data-safe.
- Add audit logs for admin actions.
- Update docs and changelog.
```

## Prompt: implement working hours and blocked time

```text
Implement Milestone 5: working hours and blocked time.

Tasks:
- Add admin settings page for working days/hours.
- Allow doctor to enable/disable weekdays and set start/end times.
- Add blocked time form.
- Update available slot calculation to reflect changes.

Acceptance criteria:
- If doctor disables Wednesday, patients see no Wednesday slots.
- If doctor changes Monday 09:00-17:00 to 12:00-18:00, patient availability changes.
- If doctor blocks 13:00-14:00, patients cannot book that interval.

Rules:
- Validate all times server-side.
- Update docs and changelog.
```

## Prompt: implement notes, history, copy/export

```text
Implement Milestone 6: patient history, internal notes, copy actions, and CSV export.

Tasks:
- Add patient list and patient details page.
- Show patient visit history.
- Add internal note creation/editing.
- Add warning that notes are not full medical documentation.
- Add copy patient info action.
- Add copy visit summary action.
- Add CSV export by date range.

Rules:
- Export must be admin-only.
- Audit export actions.
- Avoid logging patient note content.
- Localize UI in Polish and English.
- Update docs and changelog.
```

## Prompt: GDPR hardening

```text
Implement Milestone 7: GDPR/RODO hardening.

Tasks:
- Add privacy policy pages in pl and en.
- Add consent checkbox and consent version capture if missing.
- Add audit logs for sensitive actions.
- Add admin data export for a single patient.
- Add initial anonymization function for non-medical booking data.
- Add retention policy configuration placeholders.
- Add warning around notes.

Rules:
- Do not claim legal compliance automatically.
- Keep this as implementation support for the controller.
- Update docs/04-gdpr-rodo.md with actual implementation details.
- Update CHANGELOG.md.
```

## Prompt: code review

```text
Review the current branch for correctness, privacy, and maintainability.

Focus on:
- double-booking protection;
- server-side validation;
- patient data exposure in public pages;
- admin authorization;
- i18n completeness;
- database migration safety;
- GDPR/RODO-relevant data handling;
- whether docs and changelog were updated.

Return:
1. Critical issues.
2. Important but non-blocking issues.
3. Suggested improvements.
4. Exact files to change.
5. Commands to run for validation.
```

## Prompt: add a new feature safely

```text
I want to add the following feature: <describe feature>.

Before implementation:
- Read product spec, architecture, data model, GDPR docs, PLANS.md, and DECISIONS.md.
- Explain whether this belongs to MVP or post-MVP.
- Identify data model changes, privacy impact, i18n impact, and testing impact.
- Propose a small implementation plan.

During implementation:
- Keep scope narrow.
- Update docs, changelog, and decisions if needed.
- Add/modify migrations if needed.
- Run validation commands.
```

## Prompt: update docs after implementation

```text
Review the latest code changes and update documentation.

Update all relevant files:
- README.md
- PLANS.md
- CHANGELOG.md
- DECISIONS.md
- docs/01-product-spec.md
- docs/02-architecture.md
- docs/03-data-model.md
- docs/04-gdpr-rodo.md
- docs/05-i18n.md
- docs/07-runbook-dev-deploy.md
- docs/08-performance-operations.md

Do not invent features that are not implemented. Mark future ideas as planned/post-MVP.
```

