import { prisma } from "@/db/prisma";
import {
  BOOKING_DEFAULTS,
  CONSENT_TYPE_BOOKING,
  PRIVACY_TEXT_VERSION,
} from "@/lib/booking-config";
import { generateCancellationToken } from "@/lib/security/tokens";
import type { BookingInput } from "@/lib/validation/bookingSchema";
import { logAuditEvent } from "@/server/audit/logAuditEvent";
import { createConsentRecord } from "@/server/consent/createConsentRecord";
import { findOrCreatePatient } from "@/server/patients/findOrCreatePatient";

import { BookingNotConfiguredError, SlotUnavailableError } from "./errors";
import { getAvailability } from "./getAvailability";
import { getBookingContext } from "./getBookingContext";
import { isNoOverlapViolation } from "./overlap";

export type CreateAppointmentMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type CreateAppointmentResult = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  /** Raw cancellation token for the confirmation email link only. */
  cancellationToken: string;
  doctorName: string;
  /** Doctor's own email — default target for the new-booking notification. */
  doctorEmail: string;
  clinicName: string;
  /** Clinic default locale — used for the doctor-facing notification. */
  defaultLocale: string;
  timeZone: string;
};

/**
 * Create a public booking.
 *
 * Re-checks availability server-side, then creates the patient (dedup),
 * appointment, consent record, and audit log atomically in one transaction.
 * The database `appointment_no_overlap` exclusion constraint is the final
 * authority on double-booking; a violation surfaces as SlotUnavailableError.
 */
export async function createAppointment(
  input: BookingInput,
  meta: CreateAppointmentMeta = {},
): Promise<CreateAppointmentResult> {
  const context = await getBookingContext();
  if (!context) {
    throw new BookingNotConfiguredError();
  }

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  const expectedDurationMs = BOOKING_DEFAULTS.durationMinutes * 60_000;

  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt.getTime() - startsAt.getTime() !== expectedDurationMs
  ) {
    throw new SlotUnavailableError();
  }

  // Defense-in-depth: confirm the slot is currently offered before inserting.
  const availability = await getAvailability({
    clinicId: context.clinicId,
    doctorId: context.doctorId,
    timeZone: context.timeZone,
  });
  const startIso = startsAt.toISOString();
  const endIso = endsAt.toISOString();
  const isAvailable = availability.some((day) =>
    day.slots.some(
      (slot) => slot.startsAt === startIso && slot.endsAt === endIso,
    ),
  );
  if (!isAvailable) {
    throw new SlotUnavailableError();
  }

  const { token, tokenHash } = generateCancellationToken();

  try {
    const appointmentId = await prisma.$transaction(async (tx) => {
      const patient = await findOrCreatePatient(tx, context.clinicId, {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email,
      });

      const appointment = await tx.appointment.create({
        data: {
          clinicId: context.clinicId,
          doctorId: context.doctorId,
          patientId: patient.id,
          startsAt,
          endsAt,
          status: "booked",
          source: "public_booking",
          patientMessage: input.message ?? null,
          cancelTokenHash: tokenHash,
        },
        select: { id: true },
      });

      await createConsentRecord(tx, {
        clinicId: context.clinicId,
        patientId: patient.id,
        appointmentId: appointment.id,
        type: CONSENT_TYPE_BOOKING,
        textVersion: PRIVACY_TEXT_VERSION,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
      });

      await logAuditEvent(
        {
          clinicId: context.clinicId,
          actorType: "patient",
          action: "appointment.created_public",
          entityType: "appointment",
          entityId: appointment.id,
          metadata: {
            doctorId: context.doctorId,
            source: "public_booking",
          },
        },
        tx,
      );

      return appointment.id;
    });

    return {
      id: appointmentId,
      startsAt,
      endsAt,
      cancellationToken: token,
      doctorName: context.doctorName,
      doctorEmail: context.doctorEmail,
      clinicName: context.clinicName,
      defaultLocale: context.defaultLocale,
      timeZone: context.timeZone,
    };
  } catch (error) {
    if (isNoOverlapViolation(error)) {
      throw new SlotUnavailableError();
    }
    throw error;
  }
}
