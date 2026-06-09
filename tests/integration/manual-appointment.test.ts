import { expect, it } from "vitest";

import { describeDb } from "./db";

import { prisma } from "@/db/prisma";
import type { ManualAppointmentInput } from "@/lib/validation/manualAppointmentSchema";
import { createManualAppointment } from "@/server/appointments/createManualAppointment";
import {
  BookingNotConfiguredError,
  SlotUnavailableError,
} from "@/server/appointments/errors";

import {
  createClinic,
  createClinicWithDoctor,
  makeAdminSession,
} from "./factories";

function manualInput(
  overrides: Partial<ManualAppointmentInput> = {},
): ManualAppointmentInput {
  return {
    locale: "pl",
    date: "2030-03-15",
    time: "10:00",
    firstName: "Anna",
    lastName: "Nowak",
    phone: "+48600100200",
    email: "anna.nowak@example.com",
    message: "Telefon",
    ...overrides,
  };
}

describeDb("createManualAppointment (admin)", () => {
  it("creates a manual appointment (source manual_admin) with audit", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const session = makeAdminSession({
      adminUserId: "admin-1",
      clinicId: clinic.id,
      doctorId: doctor.id,
    });

    const result = await createManualAppointment(session, manualInput());

    const appointment = await prisma.appointment.findUniqueOrThrow({
      where: { id: result.id },
    });
    expect(appointment.status).toBe("booked");
    expect(appointment.source).toBe("manual_admin");
    expect(appointment.patientMessage).toBe("Telefon");

    const consentCount = await prisma.consentRecord.count({
      where: { appointmentId: result.id },
    });
    expect(consentCount).toBe(0);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: result.id, action: "appointment.created_manual" },
    });
    expect(audit?.actorType).toBe("doctor");
    expect(audit?.actorUserId).toBe("admin-1");
  });

  it("rejects a manual appointment that conflicts with an existing booking", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const session = makeAdminSession({
      adminUserId: "admin-1",
      clinicId: clinic.id,
      doctorId: doctor.id,
    });

    await createManualAppointment(session, manualInput());

    await expect(
      createManualAppointment(
        session,
        manualInput({ time: "10:30", email: "other@example.com" }),
      ),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
  });

  it("rejects a manual appointment that conflicts with blocked time", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const session = makeAdminSession({
      adminUserId: "admin-1",
      clinicId: clinic.id,
      doctorId: doctor.id,
    });

    await prisma.blockedTime.create({
      data: {
        clinicId: clinic.id,
        doctorId: doctor.id,
        startsAt: new Date("2030-03-15T00:00:00Z"),
        endsAt: new Date("2030-03-16T00:00:00Z"),
      },
    });

    await expect(
      createManualAppointment(session, manualInput()),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
  });

  it("rejects when the admin session is for a different clinic", async () => {
    await createClinicWithDoctor();
    const otherClinic = await createClinic();
    const session = makeAdminSession({
      adminUserId: "admin-2",
      clinicId: otherClinic.id,
      doctorId: null,
    });

    await expect(
      createManualAppointment(session, manualInput()),
    ).rejects.toBeInstanceOf(BookingNotConfiguredError);
  });
});
