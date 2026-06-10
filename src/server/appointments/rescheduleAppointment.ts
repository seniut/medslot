import { prisma } from "@/db/prisma";
import { BOOKING_DEFAULTS } from "@/lib/booking-config";
import { zonedWallTimeToUtc } from "@/lib/date-time/timezone";
import { generateCancellationToken } from "@/lib/security/tokens";
import type { Locale } from "@/i18n/routing";
import type { RescheduleAppointmentInput } from "@/lib/validation/rescheduleAppointmentSchema";
import { logAuditEvent } from "@/server/audit/logAuditEvent";
import type { AdminSession } from "@/server/auth/getAdminSession";

import { BookingNotConfiguredError, SlotUnavailableError } from "./errors";
import { getBookingContext } from "./getBookingContext";
import { isNoOverlapViolation } from "./overlap";

/** Data needed to email the patient that their appointment moved. */
export type RescheduleNotification = {
  to: string;
  locale: Locale;
  doctorName: string;
  clinicName: string;
  oldStartsAt: Date;
  newStartsAt: Date;
  timeZone: string;
  /** Fresh cancellation token for the email link only. */
  cancellationToken: string;
};

export type RescheduleResult = {
  id: string;
  /**
   * Present only when the patient has an email on file; null otherwise so the
   * caller skips sending.
   */
  notification: RescheduleNotification | null;
};

/**
 * Move a booked appointment to a new date/time, keeping its identity.
 *
 * The appointment row is updated in place (same id, patient, and history); only
 * `startsAt`/`endsAt` change and the status stays `booked`. Uses the same
 * double-booking protection as booking: a pre-check against other booked
 * appointments and blocked time (excluding this appointment), plus the database
 * `appointment_no_overlap` exclusion constraint as the final authority.
 *
 * Clinic-scoped and guarded by the current `booked` status, so only an active
 * appointment in the admin's clinic can move. Returns null when nothing was
 * rescheduled (wrong clinic, missing, or not booked). When the patient has an
 * email, a fresh cancellation token is issued (only its hash is stored) so the
 * notification can carry a working self-cancel link.
 */
export async function rescheduleAppointment(
  session: AdminSession,
  input: RescheduleAppointmentInput,
): Promise<RescheduleResult | null> {
  const context = await getBookingContext();
  if (!context || context.clinicId !== session.clinicId) {
    throw new BookingNotConfiguredError();
  }

  const [year, month, day] = input.date.split("-").map(Number);
  const [hour, minute] = input.time.split(":").map(Number);
  if (hour > 23 || minute > 59) {
    throw new SlotUnavailableError();
  }

  const newStartsAt = zonedWallTimeToUtc(context.timeZone, {
    year,
    month,
    day,
    hour,
    minute,
  });
  const newEndsAt = new Date(
    newStartsAt.getTime() + BOOKING_DEFAULTS.durationMinutes * 60_000,
  );

  try {
    const moved = await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findFirst({
        where: {
          id: input.id,
          clinicId: session.clinicId,
          status: "booked",
        },
        select: {
          id: true,
          startsAt: true,
          patient: { select: { email: true } },
        },
      });

      if (!appointment) {
        return null;
      }

      // Defense-in-depth pre-check (excluding this appointment); the DB
      // exclusion constraint is authoritative.
      const [conflictingAppointment, conflictingBlock] = await Promise.all([
        tx.appointment.findFirst({
          where: {
            id: { not: appointment.id },
            clinicId: context.clinicId,
            doctorId: context.doctorId,
            status: "booked",
            startsAt: { lt: newEndsAt },
            endsAt: { gt: newStartsAt },
          },
          select: { id: true },
        }),
        tx.blockedTime.findFirst({
          where: {
            clinicId: context.clinicId,
            doctorId: context.doctorId,
            startsAt: { lt: newEndsAt },
            endsAt: { gt: newStartsAt },
          },
          select: { id: true },
        }),
      ]);
      if (conflictingAppointment || conflictingBlock) {
        throw new SlotUnavailableError();
      }

      const email = appointment.patient.email?.trim() ?? "";
      const tokens = email ? generateCancellationToken() : null;

      const updated = await tx.appointment.updateMany({
        where: {
          id: appointment.id,
          clinicId: session.clinicId,
          status: "booked",
        },
        data: {
          startsAt: newStartsAt,
          endsAt: newEndsAt,
          ...(tokens ? { cancelTokenHash: tokens.tokenHash } : {}),
        },
      });
      if (updated.count === 0) {
        return null;
      }

      await logAuditEvent(
        {
          clinicId: context.clinicId,
          actorType: "doctor",
          actorUserId: session.adminUserId,
          action: "appointment.rescheduled",
          entityType: "appointment",
          entityId: appointment.id,
          metadata: {
            source: "admin",
            fromStartsAt: appointment.startsAt.toISOString(),
            toStartsAt: newStartsAt.toISOString(),
          },
        },
        tx,
      );

      return {
        id: appointment.id,
        oldStartsAt: appointment.startsAt,
        email,
        tokens,
      };
    });

    if (!moved) {
      return null;
    }

    return {
      id: moved.id,
      notification:
        moved.email && moved.tokens
          ? {
              to: moved.email,
              locale: input.locale,
              doctorName: context.doctorName,
              clinicName: context.clinicName,
              oldStartsAt: moved.oldStartsAt,
              newStartsAt,
              timeZone: context.timeZone,
              cancellationToken: moved.tokens.token,
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
