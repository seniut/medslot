import type { AppointmentSource, AppointmentStatus } from "@prisma/client";

import { prisma } from "@/db/prisma";
import { BOOKING_DEFAULTS } from "@/lib/booking-config";

export type AppointmentNote = {
  id: string;
  content: string;
  createdAt: Date;
};

export type AppointmentDetail = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  source: AppointmentSource;
  patientMessage: string | null;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  patientPhone: string;
  patientEmail: string;
  doctorName: string;
  clinicName: string;
  timeZone: string;
  /** Internal notes attached to this appointment (admin-only), newest first. */
  notes: AppointmentNote[];
};

export type GetAppointmentDetailParams = {
  clinicId: string;
  id: string;
};

/**
 * Load full appointment details for the admin area, strictly clinic-scoped.
 *
 * Returns null when the appointment does not exist or belongs to another
 * clinic, so callers cannot read across clinics. Patient contact details are
 * included because this is an authenticated admin read.
 */
export async function getAppointmentDetail({
  clinicId,
  id,
}: GetAppointmentDetailParams): Promise<AppointmentDetail | null> {
  const appointment = await prisma.appointment.findFirst({
    where: { id, clinicId },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      source: true,
      patientMessage: true,
      patientId: true,
      patient: {
        select: {
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      },
      doctor: { select: { displayName: true, timezone: true } },
      clinic: { select: { name: true, timezone: true } },
      notes: {
        orderBy: { createdAt: "desc" },
        select: { id: true, content: true, createdAt: true },
      },
    },
  });

  if (!appointment) {
    return null;
  }

  return {
    id: appointment.id,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    status: appointment.status,
    source: appointment.source,
    patientMessage: appointment.patientMessage,
    patientId: appointment.patientId,
    patientFirstName: appointment.patient.firstName,
    patientLastName: appointment.patient.lastName,
    patientPhone: appointment.patient.phone,
    patientEmail: appointment.patient.email,
    doctorName: appointment.doctor.displayName,
    clinicName: appointment.clinic.name,
    timeZone:
      appointment.doctor.timezone ||
      appointment.clinic.timezone ||
      BOOKING_DEFAULTS.fallbackTimeZone,
    notes: appointment.notes,
  };
}
