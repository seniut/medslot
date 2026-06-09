# 12 — Multi-tenancy (one platform, many clinics)

This document describes how MedSlot scales from the single-clinic MVP to a
platform that serves many clinics from one deployment, and the recommended
approach to get there without a rewrite.

## Current state (single-tenant MVP)

- The data model is already multi-tenant-ready: every domain table carries a
  `clinicId`, and `Clinic` is described as "a tenant/customer"
  (`docs/03-data-model.md`). All admin queries are scoped by `clinicId`, and
  admin sessions re-load the clinic on every request.
- There is exactly one clinic per deployment. The "which clinic is this request
  for?" decision lives in a **single** function:
  [`getActiveClinic`](../src/server/clinic/getActiveClinic.ts), which returns the
  earliest-created clinic and its earliest doctor.
- The public read models build on it:
  - `getClinicProfile` — landing-page identity and contact details.
  - `getBookingContext` — clinic/doctor/timezone for the booking page.
- Patient-facing copy that is *not* clinic-specific (button labels, the services
  line, the tagline) lives in the i18n catalogs; clinic-specific data (name,
  doctor, phone, email, address) lives in the database.

This means a second clinic does **not** require a second codebase — only data
and a tenant-resolution rule.

## Two ways to run many clinics

### Option A — one deployment per clinic (current model)

Each clinic gets its own Vercel project + Neon database + environment variables
(`CLINIC_*`, `DOCTOR_*`, `ADMIN_*`). Nothing in the code changes.

- Pros: complete data isolation, independent billing/limits, zero shared-tenant
  risk, simplest mental model.
- Cons: N deployments and N databases to operate and migrate; no cross-clinic
  reporting; per-clinic cost.
- Good for: a handful of clinics, or clinics that require hard data isolation.

### Option B — one shared deployment, many clinics (true multi-tenant)

One Vercel project and one database hold many `Clinic` rows. Each request is
mapped to a clinic by the URL or hostname.

- Pros: one deploy to operate, one migration to run, cheap per additional
  clinic, possible cross-clinic admin.
- Cons: requires tenant resolution and strict per-tenant query scoping; a bug
  that drops the `clinicId` filter leaks data across clinics.
- Good for: scaling to many clinics on one bill.

## Recommended approach for Option B

### 1. Pick a tenant addressing scheme

- **Path-based** (recommended first step): `/{clinicSlug}/...`, e.g.
  `/fizjoakademia/booking`. No DNS work; easy to test locally. Add a `[clinic]`
  dynamic segment to the public routes.
- **Subdomain / custom domain** (nicer for clinics): `fizjoakademia.medslot.app`
  or the clinic's own domain. Resolve the clinic from the `Host` header in
  `src/proxy.ts`. Can be added later on top of path-based.

### 2. Resolve the tenant in ONE place

Change `getActiveClinic` to accept the tenant key and look the clinic up by it,
instead of returning the first clinic:

```ts
export async function getActiveClinic(slug: string): Promise<ActiveClinic | null> {
  const clinic = await prisma.clinic.findUnique({
    where: { slug },
    include: { doctors: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  // ...map as today
}
```

Pass the `slug` (from `params.clinic` or the hostname) into `getClinicProfile`
and `getBookingContext`. Because every public read model already goes through
`getActiveClinic`, this is the main code change on the read path.

`Clinic.slug` is already `@unique`, so `findUnique({ where: { slug } })` is an
indexed lookup.

### 3. Keep every query scoped by `clinicId`

This already holds for the admin area and the booking/cancellation flows. The
rule for multi-tenant safety:

- Never run a domain query without a `clinicId` (or a `clinicId`-derived id)
  filter.
- Resolve `clinicId` from the authenticated admin session (admin routes) or from
  the tenant key (public routes) — never from user-supplied input directly.
- The `appointment_no_overlap` constraint and all unique keys are already
  per-clinic, so they continue to hold.

### 4. Move clinic-specific copy out of i18n

For one clinic, the services line and tagline can stay in the i18n catalogs. For
many clinics each needs its own marketing copy, so move per-clinic, still
translatable text into the database — e.g. a `ClinicContent` table keyed by
`(clinicId, locale)` with `services`, `tagline`, and `description`. Keep generic
UI labels (buttons, field names, errors) in i18n.

### 5. Per-clinic configuration and theming (optional)

- The booking constants in `src/lib/booking-config.ts` (slot length, notice,
  window) would become per-clinic columns or a `ClinicSettings` table.
- Theme colors (currently CSS variables in `src/app/globals.css`) could be made
  per-clinic by emitting CSS variables from a clinic theme record.

### 6. Onboarding and auth

- Replace the env-driven seed with an onboarding flow (or an admin "create
  clinic" action) that provisions a `Clinic`, its `Doctor`, working hours, and
  the first `AdminUser`.
- Admin sessions are already clinic-scoped; ensure an admin can only act within
  their own `clinicId` (already enforced) and cannot select another clinic by
  changing a URL.

## Migration checklist (A → B)

1. Add the tenant key to the public routes (`[clinic]` segment or host parsing
   in `src/proxy.ts`).
2. Change `getActiveClinic` to resolve by `slug`/host; thread the key through
   `getClinicProfile` and `getBookingContext`.
3. Audit every public/admin query for a `clinicId` filter (add tests that a
   clinic cannot read another clinic's data).
4. Move `services`/`tagline`/`description` into a per-clinic, per-locale store.
5. Move booking config (and optionally theming) to per-clinic settings.
6. Replace the single-clinic seed with a clinic-onboarding path.
7. Decide data residency/isolation: shared database with strict scoping, or
   schema/database-per-tenant if a clinic requires physical isolation.

## What NOT to do

- Do not deploy a separate copy of the app per clinic just to change the name,
  doctor, or contact details — those are already data.
- Do not read or trust `clinicId` from request bodies or cookies for
  authorization; always derive it from the session or the resolved tenant.
- Do not hardcode clinic-specific values (name, phone, copy) in components or
  i18n catalogs.

## Related

- `docs/02-architecture.md` — modular monolith and server-logic boundaries.
- `docs/03-data-model.md` — the `Clinic` tenant model and `clinicId` scoping.
- `DECISIONS.md` — Decision 013 (single-tenant now, multi-tenant path).
