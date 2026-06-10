import { prisma } from "@/db/prisma";
import { BOOKING_DEFAULTS } from "@/lib/booking-config";
import { zonedWallTimeToUtc } from "@/lib/date-time/timezone";
import { generateCancellationToken } from "@/lib/security/tokens";
import type { Locale } from "@/i18n/routing";
import type { ManualAppointmentInput } from "@/lib/validation/manualAppointmentSchema";
import { logAuditEvent } from "@/server/audit/logAuditEvent";
import type { AdminSession } from "@/server/auth/getAdminSession";
import { findOrCreatePatient } from "@/server/patients/findOrCreatePatient";

import { BookingNotConfiguredError, SlotUnavailableError } from "./errors";
import { getBookingContext } from "./getBookingContext";
import { isNoOverlapViolation } from "./overlap";

/** Data needed to email the patient a confirmation for a manual entry. */
export type ManualAppointmentNotification = {
  to: string;
  locale: Locale;
  doctorName: string;
  clinicName: string;
  startsAt: Date;
  timeZone: string;
  /** Raw cancellation token for the confirmation email link only. */
  cancellationToken: string;
};

export type CreateManualAppointmentResult = {
  id: string;
  /**
   * Present only when the patient should be emailed (notifyPatient set and an
   * email on file); null otherwise so the caller skips sending.
   */
  notification: ManualAppointmentNotification | null;
};

/**
 * Create an appointment manually from the admin area (phone/in-person bookings).
 *
 * Uses the same double-booking protection as public booking: a pre-check
 * against booked appointments and blocked time, plus the database
 * `appointment_no_overlap` exclusion constraint as the final authority. Unlike
 * public booking it is not restricted to computed availability slots, so the
 * doctor can book any free time. The action is clinic-scoped and audited; no
 * consent record is created for manual entries. A cancellation token is
 * generated only when the patient will be emailed a confirmation
 * (`notifyPatient` set and an email on file), so they can self-cancel like a
 * public booking; only the token hash is stored.
 */
export async function createManualAppointment(
  session: AdminSession,
  input: ManualAppointmentInput,
): Promise<CreateManualAppointmentResult> {
  const context = await getBookingContext();
  if (!context || context.clinicId !== session.clinicId) {
    throw new BookingNotConfiguredError();
  }

  const [year, month, day] = input.date.split("-").map(Number);
  const [hour, minute] = input.time.split(":").map(Number);
  if (hour > 23 || minute > 59) {
    throw new SlotUnavailableError();
  }

  const startsAt = zonedWallTimeToUtc(context.timeZone, {
    year,
    month,
    day,
    hour,
    minute,
  });
  const endsAt = new Date(
    startsAt.getTime() + BOOKING_DEFAULTS.durationMinutes * 60_000,
  );

  // Defense-in-depth pre-check; the DB exclusion constraint is authoritative.
  const [conflictingAppointment, conflictingBlock] = await Promise.all([
    prisma.appointment.findFirst({
      where: {
        clinicId: context.clinicId,
        doctorId: context.doctorId,
        status: "booked",
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true },
    }),
    prisma.blockedTime.findFirst({
      where: {
        clinicId: context.clinicId,
        doctorId: context.doctorId,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true },
    }),
  ]);
  if (conflictingAppointment || conflictingBlock) {
    throw new SlotUnavailableError();
  }

  const email = input.email?.trim() ?? "";
  const shouldNotify = input.notifyPatient === true && email.length > 0;
  const tokens = shouldNotify ? generateCancellationToken() : null;

  try {
    const appointmentId = await prisma.$transaction(async (tx) => {
      const patient = await findOrCreatePatient(tx, context.clinicId, {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email,
      });

      const appointment = await tx.appointment.create({
        data: {
          clinicId: context.clinicId,
          doctorId: context.doctorId,
          patientId: patient.id,
          startsAt,
          endsAt,
          status: "booked",
          source: "manual_admin",
          patientMessage: input.message ?? null,
          cancelTokenHash: tokens?.tokenHash ?? null,
        },
        select: { id: true },
      });

      await logAuditEvent(
        {
          clinicId: context.clinicId,
          actorType: "doctor",
          actorUserId: session.adminUserId,
          action: "appointment.created_manual",
          entityType: "appointment",
          entityId: appointment.id,
          metadata: { doctorId: context.doctorId, source: "manual_admin" },
        },
        tx,
      );

      return appointment.id;
    });

    return {
      id: appointmentId,
      notification:
        shouldNotify && tokens
          ? {
              to: email,
              locale: input.locale,
              doctorName: context.doctorName,
              clinicName: context.clinicName,
              startsAt,
              timeZone: context.timeZone,
              cancellationToken: tokens.token,
            }
          : null,
    };
  } catch (error) {
    if (isNoOverlapViolation(error)) {
      throw new SlotUnavailableError();
    }
    throw error;
  }
}
