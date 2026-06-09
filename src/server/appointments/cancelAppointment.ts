import { prisma } from "@/db/prisma";
import { BOOKING_DEFAULTS } from "@/lib/booking-config";
import { sha256Hex } from "@/lib/security/hashing";
import { logAuditEvent } from "@/server/audit/logAuditEvent";

import {
  AppointmentNotCancellableError,
  AppointmentNotFoundError,
} from "./errors";

export type CancelResult = {
  /** Patient email — used only to send the cancellation notice, never exposed. */
  to: string;
  doctorName: string;
  clinicName: string;
  startsAt: Date;
  timeZone: string;
};

/**
 * Cancel an appointment identified by its raw cancellation token.
 *
 * Only a future `booked` appointment can be cancelled. The status change to
 * `cancelled_by_patient` is what frees the slot again, because the database
 * no-overlap constraint only applies to `booked` rows. The appointment is never
 * deleted, preserving history. A conditional `updateMany` guards against a race
 * with a concurrent cancellation.
 */
export async function cancelAppointmentByToken(
  token: string,
): Promise<CancelResult> {
  const cancelTokenHash = sha256Hex(token.trim());

  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findFirst({
      where: { cancelTokenHash },
      select: {
        id: true,
        clinicId: true,
        status: true,
        startsAt: true,
        patient: { select: { email: true } },
        doctor: { select: { displayName: true, timezone: true } },
        clinic: { select: { name: true, timezone: true } },
      },
    });

    if (!appointment) {
      throw new AppointmentNotFoundError();
    }
    if (
      appointment.status !== "booked" ||
      appointment.startsAt.getTime() <= Date.now()
    ) {
      throw new AppointmentNotCancellableError();
    }

    const updated = await tx.appointment.updateMany({
      where: { id: appointment.id, status: "booked" },
      data: { status: "cancelled_by_patient", cancelledAt: new Date() },
    });
    if (updated.count === 0) {
      throw new AppointmentNotCancellableError();
    }

    await logAuditEvent(
      {
        clinicId: appointment.clinicId,
        actorType: "patient",
        action: "appointment.cancelled_by_patient",
        entityType: "appointment",
        entityId: appointment.id,
        metadata: { source: "cancellation_link" },
      },
      tx,
    );

    return {
      to: appointment.patient.email,
      doctorName: appointment.doctor.displayName,
      clinicName: appointment.clinic.name,
      startsAt: appointment.startsAt,
      timeZone:
        appointment.doctor.timezone ||
        appointment.clinic.timezone ||
        BOOKING_DEFAULTS.fallbackTimeZone,
    };
  });
}
