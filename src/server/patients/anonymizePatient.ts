import type { Prisma } from "@prisma/client";

import { prisma } from "@/db/prisma";
import { ANONYMIZED_PATIENT } from "@/lib/retention-config";
import {
  logAuditEvent,
  type AuditActorType,
} from "@/server/audit/logAuditEvent";

/** Thrown when the patient is missing or belongs to another clinic. */
export class PatientNotFoundError extends Error {
  constructor() {
    super("Patient not found");
    this.name = "PatientNotFoundError";
  }
}

/** Thrown when the patient has already been anonymized. */
export class AlreadyAnonymizedError extends Error {
  constructor() {
    super("Patient already anonymized");
    this.name = "AlreadyAnonymizedError";
  }
}

/** Thrown when the patient still has future booked appointments. */
export class PatientHasFutureAppointmentsError extends Error {
  constructor() {
    super("Patient has future booked appointments");
    this.name = "PatientHasFutureAppointmentsError";
  }
}

export type AnonymizeReason = "manual" | "retention";

export type AnonymizePatientResult = {
  notesDeleted: number;
  appointmentsRedacted: number;
};

type AnonymizePatientParams = {
  clinicId: string;
  patientId: string;
  /** "manual" = admin erasure request; "retention" = scheduled sweep. */
  reason: AnonymizeReason;
  actorUserId?: string | null;
  /** Reference time (for a consistent sweep run); defaults to now. */
  now?: Date;
};

/**
 * Anonymize a patient's personal data (GDPR/RODO erasure), strictly
 * clinic-scoped and audited.
 *
 * Contact fields are overwritten with neutral placeholders, `anonymizedAt` is
 * set, any free-text patient messages on their appointments are cleared, and
 * their internal notes are deleted — while the appointments themselves are kept
 * (date/time/status/source) so operational and aggregate history survive. The
 * patient is never physically deleted.
 *
 * Refuses to run when the patient has future booked appointments (those must be
 * cancelled or completed first) or when they are already anonymized, so contact
 * data needed to manage an upcoming visit is never destroyed. No personal data
 * is written to the audit log.
 */
export async function anonymizePatient({
  clinicId,
  patientId,
  reason,
  actorUserId = null,
  now = new Date(),
}: AnonymizePatientParams): Promise<AnonymizePatientResult> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId, deletedAt: null },
    select: { id: true, anonymizedAt: true },
  });
  if (!patient) {
    throw new PatientNotFoundError();
  }
  if (patient.anonymizedAt) {
    throw new AlreadyAnonymizedError();
  }

  const futureBooked = await prisma.appointment.count({
    where: {
      clinicId,
      patientId,
      status: "booked",
      startsAt: { gte: now },
    },
  });
  if (futureBooked > 0) {
    throw new PatientHasFutureAppointmentsError();
  }

  const actorType: AuditActorType = reason === "retention" ? "system" : "doctor";
  const action =
    reason === "retention" ? "retention.anonymized" : "patient.anonymized";

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.patient.update({
      where: { id: patientId },
      data: {
        firstName: ANONYMIZED_PATIENT.firstName,
        lastName: ANONYMIZED_PATIENT.lastName,
        phone: ANONYMIZED_PATIENT.phone,
        email: ANONYMIZED_PATIENT.email,
        anonymizedAt: now,
      },
    });

    const redacted = await tx.appointment.updateMany({
      where: { clinicId, patientId, patientMessage: { not: null } },
      data: { patientMessage: null },
    });

    const deletedNotes = await tx.doctorNote.deleteMany({
      where: { clinicId, patientId },
    });

    await logAuditEvent(
      {
        clinicId,
        actorType,
        actorUserId,
        action,
        entityType: "patient",
        entityId: patientId,
        metadata: {
          reason,
          notesDeleted: deletedNotes.count,
          appointmentsRedacted: redacted.count,
        },
      },
      tx,
    );

    return {
      notesDeleted: deletedNotes.count,
      appointmentsRedacted: redacted.count,
    };
  });
}
