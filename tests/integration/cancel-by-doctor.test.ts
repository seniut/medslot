import { expect, it } from "vitest";

import { describeDb } from "./db";

import { prisma } from "@/db/prisma";
import { cancelAppointmentByDoctor } from "@/server/appointments/cancelAppointmentByDoctor";

import {
  createAppointment,
  createClinic,
  createClinicWithDoctor,
  createPatient,
  makeAdminSession,
} from "./factories";

const START = new Date("2030-04-10T08:00:00Z");
const END = new Date("2030-04-10T08:30:00Z");

async function bookedAppointment(overrides: { email?: string } = {}) {
  const { clinic, doctor } = await createClinicWithDoctor();
  const patient = await createPatient(clinic.id, {
    email: overrides.email ?? "patient@example.com",
  });
  const appointment = await createAppointment({
    clinicId: clinic.id,
    doctorId: doctor.id,
    patientId: patient.id,
    startsAt: START,
    endsAt: END,
  });
  const session = makeAdminSession({
    adminUserId: "admin-1",
    clinicId: clinic.id,
    doctorId: doctor.id,
  });
  return { clinic, doctor, patient, appointment, session };
}

describeDb("cancelAppointmentByDoctor (admin)", () => {
  it("cancels a booked appointment and returns the patient notification payload", async () => {
    const { clinic, doctor, appointment, session } = await bookedAppointment();

    const result = await cancelAppointmentByDoctor(session, appointment.id);

    expect(result).not.toBeNull();
    expect(result?.to).toBe("patient@example.com");
    expect(result?.doctorName).toBe(doctor.displayName);
    expect(result?.clinicName).toBe(clinic.name);
    expect(result?.startsAt.getTime()).toBe(START.getTime());
    expect(result?.timeZone).toBe("Europe/Warsaw");

    const updated = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });
    expect(updated.status).toBe("cancelled_by_doctor");
    expect(updated.cancelledAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: appointment.id,
        action: "appointment.cancelled_by_doctor",
      },
    });
    expect(audit?.actorType).toBe("doctor");
    expect(audit?.actorUserId).toBe("admin-1");
  });

  it("returns an empty recipient for a manual entry without an email", async () => {
    const { appointment, session } = await bookedAppointment({ email: "" });

    const result = await cancelAppointmentByDoctor(session, appointment.id);

    expect(result).not.toBeNull();
    expect(result?.to).toBe("");
  });

  it("does nothing for an appointment in another clinic", async () => {
    const { appointment } = await bookedAppointment();
    const otherClinic = await createClinic();
    const session = makeAdminSession({
      adminUserId: "admin-2",
      clinicId: otherClinic.id,
      doctorId: null,
    });

    const result = await cancelAppointmentByDoctor(session, appointment.id);

    expect(result).toBeNull();
    const untouched = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });
    expect(untouched.status).toBe("booked");
  });

  it("does nothing for an appointment that is not booked", async () => {
    const { appointment, session } = await bookedAppointment();
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "completed", completedAt: new Date() },
    });

    const result = await cancelAppointmentByDoctor(session, appointment.id);

    expect(result).toBeNull();
    const untouched = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });
    expect(untouched.status).toBe("completed");
  });
});
