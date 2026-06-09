import { prisma } from "@/db/prisma";
import { RETENTION_DEFAULTS } from "@/lib/retention-config";
import {
  AlreadyAnonymizedError,
  PatientHasFutureAppointmentsError,
  anonymizePatient,
} from "@/server/patients/anonymizePatient";

export type RetentionSweepSummary = {
  retentionMonths: number;
  cutoff: string;
  scanned: number;
  anonymized: number;
  skipped: number;
};

type RetentionSweepParams = {
  /** Limit the sweep to one clinic; omit to scan every clinic. */
  clinicId?: string;
  /** Reference "now"; defaults to the current time. */
  now?: Date;
  /** Override the configured retention window (months). */
  retentionMonths?: number;
};

/**
 * Anonymize patients whose data has aged past the retention window
 * (GDPR/RODO storage limitation).
 *
 * A patient is a candidate only when they are not already anonymized, not
 * soft-deleted, have at least one appointment, have no future appointment of any
 * status, and their most recent appointment ended before the cutoff. Each is
 * anonymized via {@link anonymizePatient} (reason "retention"), reusing its
 * guards and audit logging. The sweep is idempotent and safe to run repeatedly.
 */
export async function retentionSweep({
  clinicId,
  now = new Date(),
  retentionMonths = RETENTION_DEFAULTS.retentionMonths,
}: RetentionSweepParams = {}): Promise<RetentionSweepSummary> {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - retentionMonths);

  const candidates = await prisma.patient.findMany({
    where: {
      ...(clinicId ? { clinicId } : {}),
      anonymizedAt: null,
      deletedAt: null,
      appointments: {
        // Has at least one appointment...
        some: {},
        // ...but none that is still upcoming or ended on/after the cutoff.
        none: {
          OR: [{ startsAt: { gte: now } }, { endsAt: { gte: cutoff } }],
        },
      },
    },
    select: { id: true, clinicId: true },
  });

  let anonymized = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    try {
      await anonymizePatient({
        clinicId: candidate.clinicId,
        patientId: candidate.id,
        reason: "retention",
        now,
      });
      anonymized += 1;
    } catch (error) {
      // A concurrent change (already anonymized, or a freshly booked future
      // visit) just means this patient is no longer a candidate — skip it.
      if (
        error instanceof AlreadyAnonymizedError ||
        error instanceof PatientHasFutureAppointmentsError
      ) {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }

  return {
    retentionMonths,
    cutoff: cutoff.toISOString(),
    scanned: candidates.length,
    anonymized,
    skipped,
  };
}
