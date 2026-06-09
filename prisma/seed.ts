// MedSlot database seed.
//
// Creates one clinic and one doctor. Clinic/doctor details and the admin
// credentials are env-driven (with development defaults) so the same script
// seeds a real single-doctor deployment. The script is idempotent: running it
// repeatedly will not create duplicates.
//
// Run with: pnpm db:seed
//
// Privacy: this seed only inserts non-patient records and never logs phone
// numbers, tokens, or secrets.

import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/security/password";

const prisma = new PrismaClient();

// Clinic / doctor are env-driven; defaults are demo values for LOCAL DEV.
// Set these in your host env (e.g. Vercel) to seed a real clinic and doctor.
const CLINIC_NAME = (process.env.CLINIC_NAME ?? "MedSlot Demo Clinic").trim();
const CLINIC_SLUG = (process.env.CLINIC_SLUG ?? "demo-clinic").trim();
const CLINIC_TIMEZONE = (process.env.CLINIC_TIMEZONE ?? "Europe/Warsaw").trim();

// Public contact details shown on the landing page. Optional: when a variable
// is unset (or empty) the corresponding row is simply hidden on the site.
const CLINIC_PHONE = process.env.CLINIC_PHONE?.trim() || undefined;
const CLINIC_EMAIL = process.env.CLINIC_EMAIL?.trim().toLowerCase() || undefined;
const CLINIC_ADDRESS = process.env.CLINIC_ADDRESS?.trim() || undefined;

const SUPPORTED_LOCALES = ["pl", "en"] as const;
const requestedLocale = (process.env.DEFAULT_LOCALE ?? "pl").trim().toLowerCase();
const DEFAULT_LOCALE = (
  SUPPORTED_LOCALES as readonly string[]
).includes(requestedLocale)
  ? requestedLocale
  : "pl";

const DOCTOR_DISPLAY_NAME = (
  process.env.DOCTOR_DISPLAY_NAME ?? "Dr. Anna Kowalska"
).trim();
const DOCTOR_EMAIL = (process.env.DOCTOR_EMAIL ?? "doctor@example.com")
  .trim()
  .toLowerCase();
// Doctor timezone defaults to the clinic timezone unless explicitly overridden.
const DOCTOR_TIMEZONE = (
  process.env.DOCTOR_TIMEZONE ?? CLINIC_TIMEZONE
).trim();

// Admin credentials are env-driven for reproducibility; defaults are for LOCAL
// DEVELOPMENT ONLY and must be overridden in any shared/production environment.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "admin@example.com")
  .trim()
  .toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "medslot-admin";

async function main() {
  // The clinic profile is env-driven, so re-running the seed refreshes the
  // configurable fields (name, locale, timezone, public contact details) from
  // the environment. Contact fields left unset in the environment are not
  // touched here.
  const clinic = await prisma.clinic.upsert({
    where: { slug: CLINIC_SLUG },
    update: {
      name: CLINIC_NAME,
      defaultLocale: DEFAULT_LOCALE,
      timezone: CLINIC_TIMEZONE,
      phone: CLINIC_PHONE,
      email: CLINIC_EMAIL,
      address: CLINIC_ADDRESS,
    },
    create: {
      name: CLINIC_NAME,
      slug: CLINIC_SLUG,
      defaultLocale: DEFAULT_LOCALE,
      timezone: CLINIC_TIMEZONE,
      phone: CLINIC_PHONE,
      email: CLINIC_EMAIL,
      address: CLINIC_ADDRESS,
    },
  });

  // Doctor has no unique business key in the schema, so guard manually to keep
  // the seed idempotent.
  const existingDoctor = await prisma.doctor.findFirst({
    where: { clinicId: clinic.id, email: DOCTOR_EMAIL },
  });

  const doctor =
    existingDoctor ??
    (await prisma.doctor.create({
      data: {
        clinicId: clinic.id,
        displayName: DOCTOR_DISPLAY_NAME,
        email: DOCTOR_EMAIL,
        timezone: DOCTOR_TIMEZONE,
      },
    }));

  // Working hours: Monday–Friday, 09:00–17:00. Guarded per day so reruns do
  // not create duplicates (WorkingHour has no unique business key).
  const WORKDAYS = [1, 2, 3, 4, 5];
  for (const dayOfWeek of WORKDAYS) {
    const existing = await prisma.workingHour.findFirst({
      where: { clinicId: clinic.id, doctorId: doctor.id, dayOfWeek },
    });
    if (!existing) {
      await prisma.workingHour.create({
        data: {
          clinicId: clinic.id,
          doctorId: doctor.id,
          dayOfWeek,
          startTime: "09:00",
          endTime: "17:00",
          isActive: true,
        },
      });
    }
  }

  // Admin user for the admin area (Milestone 4). Guarded by unique email so the
  // seed stays idempotent. The password is never logged.
  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: ADMIN_EMAIL },
  });
  if (!existingAdmin) {
    await prisma.adminUser.create({
      data: {
        clinicId: clinic.id,
        doctorId: doctor.id,
        email: ADMIN_EMAIL,
        passwordHash: await hashPassword(ADMIN_PASSWORD),
        role: "owner",
      },
    });
  }

  console.log(
    `Seed complete: clinic "${clinic.name}" (${clinic.slug}), doctor "${doctor.displayName}", working hours Mon–Fri 09:00–17:00, admin user "${ADMIN_EMAIL}".`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
