import { prisma } from "@/db/prisma";
import { BOOKING_DEFAULTS } from "@/lib/booking-config";
import { logAuditEvent } from "@/server/audit/logAuditEvent";
import type { AdminSession } from "@/server/auth/getAdminSession";

export type DoctorCancelResult = {
  /**
   * Patient email — used only to send the cancellation notice, never exposed.
   * May be empty for manual entries created without an email address.
   */
  to: string;
  doctorName: string;
  clinicName: string;
  startsAt: Date;
  timeZone: string;
};

/**
 * Cancel a booked appointment as the clinic/doctor.
 *
 * Clinic-scoped and guarded by the current `booked` status, so only an active
 * appointment in the admin's clinic transitions to `cancelled_by_doctor` (which
 * frees the slot, because the no-overlap constraint applies only to `booked`
 * rows). The appointment is never deleted, preserving history. The audit row is
 * written in the same transaction.
 *
 * Returns the data needed to notify the patient, or null when nothing was
 * cancelled (wrong clinic, missing, or already in a terminal state).
 */
export async function cancelAppointmentByDoctor(
  session: AdminSession,
  appointmentId: string,
): Promise<DoctorCancelResult | null> {
  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findFirst({
      where: {
        id: appointmentId,
        clinicId: session.clinicId,
        status: "booked",
      },
      select: {
        id: true,
        clinicId: true,
        startsAt: true,
        patient: { select: { email: true } },
        doctor: { select: { displayName: true, timezone: true } },
        clinic: { select: { name: true, timezone: true } },
      },
    });

    if (!appointment) {
      return null;
    }

    const updated = await tx.appointment.updateMany({
      where: { id: appointment.id, status: "booked" },
      data: { status: "cancelled_by_doctor", cancelledAt: new Date() },
    });
    if (updated.count === 0) {
      return null;
    }

    await logAuditEvent(
      {
        clinicId: appointment.clinicId,
        actorType: "doctor",
        actorUserId: session.adminUserId,
        action: "appointment.cancelled_by_doctor",
        entityType: "appointment",
        entityId: appointment.id,
        metadata: { source: "admin" },
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
