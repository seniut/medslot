import { prisma } from "@/db/prisma";

export type PatientListItem = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  visitCount: number;
  lastVisitAt: Date | null;
  /** Set once the patient's personal data has been anonymized (GDPR/RODO). */
  anonymizedAt: Date | null;
};

/**
 * List patients for the admin area, strictly clinic-scoped.
 *
 * Returns each patient with their total visit count and most recent visit
 * instant (across all statuses) so the doctor can scan the contact list. This
 * is an authenticated admin read, so patient contact details are included.
 */
export async function listPatients({
  clinicId,
}: {
  clinicId: string;
}): Promise<PatientListItem[]> {
  const patients = await prisma.patient.findMany({
    where: { clinicId, deletedAt: null },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 500,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      anonymizedAt: true,
      _count: { select: { appointments: true } },
      appointments: {
        orderBy: { startsAt: "desc" },
        take: 1,
        select: { startsAt: true },
      },
    },
  });

  return patients.map((patient) => ({
    id: patient.id,
    firstName: patient.firstName,
    lastName: patient.lastName,
    phone: patient.phone,
    email: patient.email,
    visitCount: patient._count.appointments,
    lastVisitAt: patient.appointments[0]?.startsAt ?? null,
    anonymizedAt: patient.anonymizedAt,
  }));
}
