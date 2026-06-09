import { prisma } from "@/db/prisma";
import { logAuditEvent } from "@/server/audit/logAuditEvent";

export type PatientDataExport = {
  exportedAt: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    anonymizedAt: string | null;
  };
  appointments: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
    source: string;
    patientMessage: string | null;
    createdAt: string;
    cancelledAt: string | null;
    completedAt: string | null;
  }>;
  notes: Array<{
    id: string;
    appointmentId: string | null;
    content: string;
    createdAt: string;
  }>;
  consents: Array<{
    id: string;
    appointmentId: string;
    type: string;
    textVersion: string;
    acceptedAt: string;
  }>;
};

export type ExportPatientDataResult = {
  fileName: string;
  data: PatientDataExport;
};

/**
 * Assemble a patient's full record (profile, appointments, notes, consent
 * records) for a GDPR/RODO access/portability request, strictly clinic-scoped
 * and audited.
 *
 * Returns null when the patient does not exist or belongs to another clinic.
 * The export is authenticated admin output; the audit log records only counts,
 * never patient data.
 */
export async function exportPatientData({
  clinicId,
  patientId,
  actorUserId = null,
}: {
  clinicId: string;
  patientId: string;
  actorUserId?: string | null;
}): Promise<ExportPatientDataResult | null> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      anonymizedAt: true,
      appointments: {
        orderBy: { startsAt: "desc" },
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          status: true,
          source: true,
          patientMessage: true,
          createdAt: true,
          cancelledAt: true,
          completedAt: true,
        },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          appointmentId: true,
          content: true,
          createdAt: true,
        },
      },
    },
  });

  if (!patient) {
    return null;
  }

  const consents = await prisma.consentRecord.findMany({
    where: { clinicId, patientId },
    orderBy: { acceptedAt: "desc" },
    select: {
      id: true,
      appointmentId: true,
      type: true,
      textVersion: true,
      acceptedAt: true,
    },
  });

  const data: PatientDataExport = {
    exportedAt: new Date().toISOString(),
    patient: {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      phone: patient.phone,
      email: patient.email,
      createdAt: patient.createdAt.toISOString(),
      updatedAt: patient.updatedAt.toISOString(),
      deletedAt: patient.deletedAt?.toISOString() ?? null,
      anonymizedAt: patient.anonymizedAt?.toISOString() ?? null,
    },
    appointments: patient.appointments.map((appointment) => ({
      id: appointment.id,
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt.toISOString(),
      status: appointment.status,
      source: appointment.source,
      patientMessage: appointment.patientMessage,
      createdAt: appointment.createdAt.toISOString(),
      cancelledAt: appointment.cancelledAt?.toISOString() ?? null,
      completedAt: appointment.completedAt?.toISOString() ?? null,
    })),
    notes: patient.notes.map((note) => ({
      id: note.id,
      appointmentId: note.appointmentId,
      content: note.content,
      createdAt: note.createdAt.toISOString(),
    })),
    consents: consents.map((consent) => ({
      id: consent.id,
      appointmentId: consent.appointmentId,
      type: consent.type,
      textVersion: consent.textVersion,
      acceptedAt: consent.acceptedAt.toISOString(),
    })),
  };

  await logAuditEvent({
    clinicId,
    actorType: "doctor",
    actorUserId,
    action: "patient.exported",
    entityType: "patient",
    entityId: patient.id,
    metadata: {
      appointments: data.appointments.length,
      notes: data.notes.length,
      consents: data.consents.length,
    },
  });

  return { fileName: `medslot-patient_${patient.id}.json`, data };
}
