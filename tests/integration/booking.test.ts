import { expect, it } from "vitest";

import { describeDb } from "./db";

import { prisma } from "@/db/prisma";
import {
  CONSENT_TYPE_BOOKING,
  PRIVACY_TEXT_VERSION,
} from "@/lib/booking-config";
import { sha256Hex } from "@/lib/security/hashing";
import type { BookingInput } from "@/lib/validation/bookingSchema";
import { createAppointment } from "@/server/appointments/createAppointment";
import {
  BookingNotConfiguredError,
  SlotUnavailableError,
} from "@/server/appointments/errors";

import {
  allWeekHours,
  createClinic,
  createClinicWithDoctor,
  firstAvailableSlot,
  setWorkingHours,
} from "./factories";

function bookingInput(
  slot: { startsAt: string; endsAt: string },
  overrides: Partial<BookingInput> = {},
): BookingInput {
  return {
    locale: "pl",
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    firstName: "Jan",
    lastName: "Kowalski",
    phone: "+48600700800",
    email: "jan.kowalski@example.com",
    message: "Prosze o kontakt",
    consent: true,
    ...overrides,
  };
}

describeDb("createAppointment (public booking)", () => {
  it("throws BookingNotConfiguredError when no doctor is configured", async () => {
    await createClinic();
    const future = new Date(Date.now() + 86_400_000);
    const slot = {
      startsAt: future.toISOString(),
      endsAt: new Date(future.getTime() + 3_600_000).toISOString(),
    };

    await expect(createAppointment(bookingInput(slot))).rejects.toBeInstanceOf(
      BookingNotConfiguredError,
    );
  });

  it("creates a booking with consent, audit and a hashed cancellation token", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    await setWorkingHours(clinic.id, doctor.id, allWeekHours());
    const slot = await firstAvailableSlot({
      clinicId: clinic.id,
      doctorId: doctor.id,
      timeZone: clinic.timezone,
    });

    const result = await createAppointment(bookingInput(slot));

    expect(result.cancellationToken).toBeTypeOf("string");
    expect(result.cancellationToken.length).toBeGreaterThan(0);

    const appointment = await prisma.appointment.findUniqueOrThrow({
      where: { id: result.id },
    });
    expect(appointment.status).toBe("booked");
    expect(appointment.source).toBe("public_booking");
    expect(appointment.patientMessage).toBe("Prosze o kontakt");
    expect(appointment.cancelTokenHash).toBe(
      sha256Hex(result.cancellationToken),
    );

    const consent = await prisma.consentRecord.findFirstOrThrow({
      where: { appointmentId: result.id },
    });
    expect(consent.type).toBe(CONSENT_TYPE_BOOKING);
    expect(consent.textVersion).toBe(PRIVACY_TEXT_VERSION);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: result.id, action: "appointment.created_public" },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorType).toBe("patient");

    const patient = await prisma.patient.findFirstOrThrow({
      where: { clinicId: clinic.id, email: "jan.kowalski@example.com" },
    });
    expect(patient.firstName).toBe("Jan");
  });

  it("re-checks availability and rejects a slot that is already booked", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    await setWorkingHours(clinic.id, doctor.id, allWeekHours());
    const slot = await firstAvailableSlot({
      clinicId: clinic.id,
      doctorId: doctor.id,
      timeZone: clinic.timezone,
    });

    await createAppointment(bookingInput(slot));

    await expect(
      createAppointment(
        bookingInput(slot, { email: "second.patient@example.com" }),
      ),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
  });

  it("rejects a slot whose duration is not the configured length", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    await setWorkingHours(clinic.id, doctor.id, allWeekHours());
    const slot = await firstAvailableSlot({
      clinicId: clinic.id,
      doctorId: doctor.id,
      timeZone: clinic.timezone,
    });
    const badSlot = {
      startsAt: slot.startsAt,
      endsAt: new Date(
        new Date(slot.startsAt).getTime() + 30 * 60_000,
      ).toISOString(),
    };

    await expect(
      createAppointment(bookingInput(badSlot)),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
  });

  it("deduplicates the patient by email across bookings", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    await setWorkingHours(clinic.id, doctor.id, allWeekHours());

    const slot1 = await firstAvailableSlot({
      clinicId: clinic.id,
      doctorId: doctor.id,
      timeZone: clinic.timezone,
    });
    await createAppointment(bookingInput(slot1));

    const slot2 = await firstAvailableSlot({
      clinicId: clinic.id,
      doctorId: doctor.id,
      timeZone: clinic.timezone,
    });
    await createAppointment(bookingInput(slot2));

    const patientCount = await prisma.patient.count({
      where: { clinicId: clinic.id },
    });
    const appointmentCount = await prisma.appointment.count({
      where: { clinicId: clinic.id },
    });
    expect(patientCount).toBe(1);
    expect(appointmentCount).toBe(2);
  });
});
