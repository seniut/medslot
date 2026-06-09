# ADR 0001 — Initial Tech Stack

Status: Accepted

## Context

We need to build a small but production-oriented appointment calendar with:

- patient booking;
- admin calendar;
- manual booking;
- patient history;
- notes;
- i18n;
- GDPR/RODO-aware data handling;
- simple deployment and support.

The project should be maintainable by one developer.

## Decision

Use:

- Next.js App Router;
- TypeScript;
- PostgreSQL;
- Prisma;
- Tailwind CSS;
- shadcn/ui;
- FullCalendar for admin calendar;
- simple public date/slot picker;
- Auth.js or Supabase Auth;
- Resend/Postmark-compatible email adapter;
- Vercel deployment.

## Why

- One project for frontend and server logic.
- PostgreSQL supports transactions and constraints for reliable booking logic.
- Prisma speeds up development and migration management.
- Tailwind/shadcn enables fast UI development.
- Vercel makes Next.js deployment simple.
- The stack can later evolve into a larger SaaS.

## Alternatives considered

### Separate frontend + backend

Rejected for MVP because it increases deployment and support complexity.

### WordPress/plugin

Rejected because it reduces control over booking logic, data model, and product evolution.

### Google Calendar as source of truth

Rejected because appointment data needs patient history, statuses, cancellation tokens, notes, and audit logs.

### MongoDB

Rejected because appointment scheduling is relational and needs transactions/constraints.

## Consequences

Positive:

- quick MVP development;
- simple deployment;
- easy support;
- good developer experience.

Negative:

- serverless/runtime constraints must be understood;
- background jobs may need a separate solution later;
- complex future integrations may require additional architecture.

