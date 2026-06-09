import { expect, it } from "vitest";

import { describeDb } from "./db";

import { prisma } from "@/db/prisma";
import { generateCancellationToken } from "@/lib/security/tokens";
import { cancelAppointmentByToken } from "@/server/appointments/cancelAppointment";
import {
  AppointmentNotCancellableError,
  AppointmentNotFoundError,
} from "@/server/appointments/errors";
import { getAppointmentByCancelToken } from "@/server/appointments/getCancellation";

import {
  createAppointment,
  createClinicWithDoctor,
  createPatient,
} from "./factories";

const FUTURE_START = new Date("2030-05-20T10:00:00Z");
const FUTURE_END = new Date("2030-05-20T11:00:00Z");
const PAST_START = new Date("2020-01-01T10:00:00Z");
const PAST_END = new Date("2020-01-01T11:00:00Z");

async function seedBookedAppointment(
  startsAt: Date,
  endsAt: Date,
): Promise<{ token: string; appointmentId: string; email: string }> {
  const { clinic, doctor } = await createClinicWithDoctor();
  const patient = await createPatient(clinic.id, {
    email: "cancel.me@example.com",
  });
  const { token, tokenHash } = generateCancellationToken();
  const appointment = await createAppointment({
    clinicId: clinic.id,
    doctorId: doctor.id,
    patientId: patient.id,
    startsAt,
    endsAt,
    cancelTokenHash: tokenHash,
  });
  return { token, appointmentId: appointment.id, email: patient.email };
}

describeDb("cancellation by token", () => {
  it("cancels a future booked appointment and audits it", async () => {
    const { token, appointmentId, email } = await seedBookedAppointment(
      FUTURE_START,
      FUTURE_END,
    );

    const result = await cancelAppointmentByToken(token);
    expect(result.to).toBe(email);

    const appointment = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
    });
    expect(appointment.status).toBe("cancelled_by_patient");
    expect(appointment.cancelledAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: appointmentId,
        action: "appointment.cancelled_by_patient",
      },
    });
    expect(audit).not.toBeNull();
  });

  it("looks up an appointment by token without exposing patient data", async () => {
    const { token, appointmentId } = await seedBookedAppointment(
      FUTURE_START,
      FUTURE_END,
    );

    const view = await getAppointmentByCancelToken(token);
    expect(view?.id).toBe(appointmentId);
    expect(view?.status).toBe("booked");
    expect(view?.doctorName).toBeTypeOf("string");
    expect(view?.clinicName).toBeTypeOf("string");
    expect(view).not.toHaveProperty("patient");
    expect(view).not.toHaveProperty("email");
  });

  it("returns null and throws for an unknown token", async () => {
    await seedBookedAppointment(FUTURE_START, FUTURE_END);

    expect(await getAppointmentByCancelToken("does-not-exist")).toBeNull();
    await expect(
      cancelAppointmentByToken("does-not-exist"),
    ).rejects.toBeInstanceOf(AppointmentNotFoundError);
  });

  it("refuses to cancel a past appointment", async () => {
    const { token } = await seedBookedAppointment(PAST_START, PAST_END);

    await expect(cancelAppointmentByToken(token)).rejects.toBeInstanceOf(
      AppointmentNotCancellableError,
    );
  });

  it("refuses to cancel an already-cancelled appointment", async () => {
    const { token } = await seedBookedAppointment(FUTURE_START, FUTURE_END);

    await cancelAppointmentByToken(token);
    await expect(cancelAppointmentByToken(token)).rejects.toBeInstanceOf(
      AppointmentNotCancellableError,
    );
  });

  it("frees the slot so the time can be re-booked", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const patient = await createPatient(clinic.id);
    const { token, tokenHash } = generateCancellationToken();
    await createAppointment({
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: patient.id,
      startsAt: FUTURE_START,
      endsAt: FUTURE_END,
      cancelTokenHash: tokenHash,
    });

    await cancelAppointmentByToken(token);

    const rebooked = await createAppointment({
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: patient.id,
      startsAt: FUTURE_START,
      endsAt: FUTURE_END,
    });
    expect(rebooked.id).toBeTypeOf("string");
  });
});
