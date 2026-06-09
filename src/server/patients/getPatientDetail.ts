import type { AppointmentSource, AppointmentStatus } from "@prisma/client";

import { prisma } from "@/db/prisma";

export type PatientVisit = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  source: AppointmentSource;
};

export type PatientNote = {
  id: string;
  content: string;
  createdAt: Date;
  appointmentId: string | null;
};

export type PatientDetail = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  /** Set once the patient's personal data has been anonymized (GDPR/RODO). */
  anonymizedAt: Date | null;
  /** Full visit history (all statuses), most recent first. */
  visits: PatientVisit[];
  /** Internal notes (admin-only), most recent first. */
  notes: PatientNote[];
};

/**
 * Load one patient with their full visit history and internal notes, strictly
 * clinic-scoped.
 *
 * Returns null when the patient does not exist or belongs to another clinic, so
 * callers cannot read across clinics. The visit history intentionally includes
 * every status (booked, completed, cancelled, no-show) because cancelled and
 * historical visits must remain visible to the doctor.
 */
export async function getPatientDetail({
  clinicId,
  patientId,
}: {
  clinicId: string;
  patientId: string;
}): Promise<PatientDetail | null> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      anonymizedAt: true,
      appointments: {
        orderBy: { startsAt: "desc" },
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          status: true,
          source: true,
        },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          createdAt: true,
          appointmentId: true,
        },
      },
    },
  });

  if (!patient) {
    return null;
  }

  return {
    id: patient.id,
    firstName: patient.firstName,
    lastName: patient.lastName,
    phone: patient.phone,
    email: patient.email,
    anonymizedAt: patient.anonymizedAt,
    visits: patient.appointments,
    notes: patient.notes,
  };
}
