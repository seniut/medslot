// MedSlot test-data cleanup.
//
// Hard-deletes patients (and all their appointments, notes, consents, and audit
// rows) that match an explicit test marker. Intended for removing data created
// while manually verifying a deployment — NOT a normal operation (the app
// soft-deletes/anonymizes patients; this physically removes test rows).
//
// SAFETY:
// - Dry run by default: prints what WOULD be deleted and changes nothing.
//   Pass --apply to actually delete (inside a single transaction).
// - Refuses to run without at least one --email or --marker, so it can never
//   wipe the whole table by accident.
// - Match patients narrowly by the exact test email(s) you booked with, and/or
//   a substring marker (matched against email or last name). Optionally scope
//   to one clinic with --clinic <slug>.
//
// Examples (run against whatever DATABASE_URL points to — set the prod URL to
// clean prod):
//   pnpm db:cleanup-test --email test@medslot.local
//   pnpm db:cleanup-test --marker ZZ_TEST --clinic fizjoakademia
//   pnpm db:cleanup-test --email test@medslot.local --apply
//
// Privacy: prints only ids and counts — never names, emails, phones, or notes.

import type { Prisma } from "@prisma/client";

import { prisma } from "../src/db/prisma";

type Args = {
  emails: string[];
  markers: string[];
  clinicSlug: string | null;
  apply: boolean;
};

function parseArgs(argv: string[]): Args {
  const emails: string[] = [];
  const markers: string[] = [];
  let clinicSlug: string | null = null;
  let apply = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") {
      apply = true;
    } else if (arg === "--email") {
      const value = argv[(i += 1)]?.trim();
      if (value) emails.push(value);
    } else if (arg === "--marker") {
      const value = argv[(i += 1)]?.trim();
      if (value) markers.push(value);
    } else if (arg === "--clinic") {
      const value = argv[(i += 1)]?.trim();
      if (value) clinicSlug = value;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { emails, markers, clinicSlug, apply };
}

function buildPatientWhere(
  args: Args,
  clinicId: string | null,
): Prisma.PatientWhereInput {
  const or: Prisma.PatientWhereInput[] = [];
  for (const email of args.emails) {
    or.push({ email: { equals: email, mode: "insensitive" } });
  }
  for (const marker of args.markers) {
    or.push({ email: { contains: marker, mode: "insensitive" } });
    or.push({ lastName: { contains: marker, mode: "insensitive" } });
  }

  const where: Prisma.PatientWhereInput = { OR: or };
  if (clinicId) {
    where.clinicId = clinicId;
  }
  return where;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.emails.length === 0 && args.markers.length === 0) {
    throw new Error(
      "Refusing to run without a target. Pass at least one --email <addr> or --marker <substring>.",
    );
  }

  let clinicId: string | null = null;
  if (args.clinicSlug) {
    const clinic = await prisma.clinic.findUnique({
      where: { slug: args.clinicSlug },
      select: { id: true },
    });
    if (!clinic) {
      throw new Error(`No clinic found for slug "${args.clinicSlug}".`);
    }
    clinicId = clinic.id;
  }

  const where = buildPatientWhere(args, clinicId);
  const patients = await prisma.patient.findMany({
    where,
    select: { id: true, clinicId: true },
  });
  const patientIds = patients.map((p) => p.id);

  const appointments = patientIds.length
    ? await prisma.appointment.findMany({
        where: { patientId: { in: patientIds } },
        select: { id: true },
      })
    : [];
  const appointmentIds = appointments.map((a) => a.id);
  const entityIds = [...appointmentIds, ...patientIds];

  const [consentCount, noteCount, auditCount] = await Promise.all([
    appointmentIds.length
      ? prisma.consentRecord.count({
          where: { appointmentId: { in: appointmentIds } },
        })
      : Promise.resolve(0),
    patientIds.length
      ? prisma.doctorNote.count({ where: { patientId: { in: patientIds } } })
      : Promise.resolve(0),
    entityIds.length
      ? prisma.auditLog.count({ where: { entityId: { in: entityIds } } })
      : Promise.resolve(0),
  ]);

  console.log("MedSlot test-data cleanup");
  console.log(
    `  Mode:              ${args.apply ? "APPLY (deleting)" : "DRY RUN (no changes)"}`,
  );
  console.log(`  Clinic filter:     ${args.clinicSlug ?? "(none)"}`);
  console.log(
    `  Emails:            ${args.emails.length ? args.emails.join(", ") : "(none)"}`,
  );
  console.log(
    `  Markers:           ${args.markers.length ? args.markers.join(", ") : "(none)"}`,
  );
  console.log("  Matched:");
  console.log(`    Patients:        ${patientIds.length}`);
  console.log(`    Appointments:    ${appointmentIds.length}`);
  console.log(`    Consent records: ${consentCount}`);
  console.log(`    Doctor notes:    ${noteCount}`);
  console.log(`    Audit rows:      ${auditCount}`);

  if (patientIds.length === 0) {
    console.log("Nothing matched. Exiting.");
    return;
  }

  if (!args.apply) {
    console.log(
      "\nDRY RUN — no rows were deleted. Re-run with --apply to delete the rows above.",
    );
    return;
  }

  // FK-safe deletion order, atomic so a failure leaves nothing half-deleted:
  // consents -> notes -> appointments -> audit (loose) -> patients.
  const result = await prisma.$transaction(async (tx) => {
    const consents = appointmentIds.length
      ? await tx.consentRecord.deleteMany({
          where: { appointmentId: { in: appointmentIds } },
        })
      : { count: 0 };
    const notes = await tx.doctorNote.deleteMany({
      where: { patientId: { in: patientIds } },
    });
    const appts = await tx.appointment.deleteMany({
      where: { patientId: { in: patientIds } },
    });
    const audits = entityIds.length
      ? await tx.auditLog.deleteMany({ where: { entityId: { in: entityIds } } })
      : { count: 0 };
    const pts = await tx.patient.deleteMany({
      where: { id: { in: patientIds } },
    });
    return {
      consents: consents.count,
      notes: notes.count,
      appts: appts.count,
      audits: audits.count,
      patients: pts.count,
    };
  });

  console.log("\nDeleted:");
  console.log(`  Consent records: ${result.consents}`);
  console.log(`  Doctor notes:    ${result.notes}`);
  console.log(`  Appointments:    ${result.appts}`);
  console.log(`  Audit rows:      ${result.audits}`);
  console.log(`  Patients:        ${result.patients}`);
}

main()
  .catch((error) => {
    console.error("Test-data cleanup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
