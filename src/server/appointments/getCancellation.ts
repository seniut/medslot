import type { AppointmentStatus } from "@prisma/client";

import { prisma } from "@/db/prisma";
import { BOOKING_DEFAULTS } from "@/lib/booking-config";
import { sha256Hex } from "@/lib/security/hashing";

export type CancelAppointmentView = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  doctorName: string;
  clinicName: string;
  timeZone: string;
};

/**
 * Look up an appointment by its raw cancellation token.
 *
 * The token is hashed and matched against `Appointment.cancelTokenHash` — the
 * raw token is never stored or logged. No patient fields are selected, so the
 * returned view is safe to render on the public cancellation page. Returns null
 * when the token does not match any appointment.
 */
export async function getAppointmentByCancelToken(
  token: string,
): Promise<CancelAppointmentView | null> {
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const cancelTokenHash = sha256Hex(trimmed);
  const appointment = await prisma.appointment.findFirst({
    where: { cancelTokenHash },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      doctor: { select: { displayName: true, timezone: true } },
      clinic: { select: { name: true, timezone: true } },
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
    doctorName: appointment.doctor.displayName,
    clinicName: appointment.clinic.name,
    timeZone:
      appointment.doctor.timezone ||
      appointment.clinic.timezone ||
      BOOKING_DEFAULTS.fallbackTimeZone,
  };
}
