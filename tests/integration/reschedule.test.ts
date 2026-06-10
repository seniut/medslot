import { expect, it } from "vitest";

import { describeDb } from "./db";

import { prisma } from "@/db/prisma";
import { BOOKING_DEFAULTS } from "@/lib/booking-config";
import { zonedWallTimeToUtc } from "@/lib/date-time/timezone";
import { sha256Hex } from "@/lib/security/hashing";
import {
  BookingNotConfiguredError,
  SlotUnavailableError,
} from "@/server/appointments/errors";
import { rescheduleAppointment } from "@/server/appointments/rescheduleAppointment";

import {
  createAppointment,
  createClinic,
  createClinicWithDoctor,
  createPatient,
  makeAdminSession,
} from "./factories";

const TZ = "Europe/Warsaw";
const DURATION_MS = BOOKING_DEFAULTS.durationMinutes * 60_000;

function wall(hour: number, minute = 0): Date {
  return zonedWallTimeToUtc(TZ, {
    year: 2030,
    month: 5,
    day: 13,
    hour,
    minute,
  });
}

async function bookedAppointment(
  overrides: { email?: string; startHour?: number } = {},
) {
  const { clinic, doctor } = await createClinicWithDoctor();
  const patient = await createPatient(clinic.id, {
    email: overrides.email ?? "anna.nowak@example.com",
  });
  const startsAt = wall(overrides.startHour ?? 9);
  const appointment = await createAppointment({
    clinicId: clinic.id,
    doctorId: doctor.id,
    patientId: patient.id,
    startsAt,
    endsAt: new Date(startsAt.getTime() + DURATION_MS),
  });
  const session = makeAdminSession({
    adminUserId: "admin-1",
    clinicId: clinic.id,
    doctorId: doctor.id,
  });
  return { clinic, doctor, patient, appointment, startsAt, session };
}

describeDb("rescheduleAppointment (admin)", () => {
  it("moves a booked appointment and returns the patient notification", async () => {
    const { clinic, doctor, appointment, startsAt, session } =
      await bookedAppointment();

    const result = await rescheduleAppointment(session, {
      locale: "pl",
      id: appointment.id,
      date: "2030-05-13",
      time: "10:00",
    });

    const newStartsAt = wall(10);
    expect(result).not.toBeNull();
    expect(result?.notification).not.toBeNull();
    expect(result?.notification?.to).toBe("anna.nowak@example.com");
    expect(result?.notification?.doctorName).toBe(doctor.displayName);
    expect(result?.notification?.clinicName).toBe(clinic.name);
    expect(result?.notification?.oldStartsAt.getTime()).toBe(
      startsAt.getTime(),
    );
    expect(result?.notification?.newStartsAt.getTime()).toBe(
      newStartsAt.getTime(),
    );

    const token = result?.notification?.cancellationToken ?? "";
    expect(token.length).toBeGreaterThan(0);

    const updated = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });
    expect(updated.status).toBe("booked");
    expect(updated.startsAt.getTime()).toBe(newStartsAt.getTime());
    expect(updated.endsAt.getTime()).toBe(newStartsAt.getTime() + DURATION_MS);
    expect(updated.cancelTokenHash).toBe(sha256Hex(token));

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: appointment.id, action: "appointment.rescheduled" },
    });
    expect(audit?.actorType).toBe("doctor");
    expect(audit?.actorUserId).toBe("admin-1");
  });

  it("moves the appointment but skips notification when no email is on file", async () => {
    const { appointment, session } = await bookedAppointment({ email: "" });

    const result = await rescheduleAppointment(session, {
      locale: "pl",
      id: appointment.id,
      date: "2030-05-13",
      time: "10:00",
    });

    expect(result).not.toBeNull();
    expect(result?.notification).toBeNull();

    const updated = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });
    expect(updated.startsAt.getTime()).toBe(wall(10).getTime());
    expect(updated.cancelTokenHash).toBeNull();
  });

  it("rejects a move that overlaps another booked appointment", async () => {
    const { clinic, doctor, appointment, startsAt, session } =
      await bookedAppointment({ startHour: 9 });
    const otherPatient = await createPatient(clinic.id, {
      email: "other@example.com",
    });
    const blockerStart = wall(11);
    await createAppointment({
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: otherPatient.id,
      startsAt: blockerStart,
      endsAt: new Date(blockerStart.getTime() + DURATION_MS),
    });

    await expect(
      rescheduleAppointment(session, {
        locale: "pl",
        id: appointment.id,
        date: "2030-05-13",
        time: "11:00",
      }),
    ).rejects.toBeInstanceOf(SlotUnavailableError);

    const untouched = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });
    expect(untouched.startsAt.getTime()).toBe(startsAt.getTime());
  });

  it("returns null for an appointment that is not booked", async () => {
    const { appointment, startsAt, session } = await bookedAppointment();
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "completed", completedAt: new Date() },
    });

    const result = await rescheduleAppointment(session, {
      locale: "pl",
      id: appointment.id,
      date: "2030-05-13",
      time: "10:00",
    });

    expect(result).toBeNull();
    const untouched = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
    });
    expect(untouched.startsAt.getTime()).toBe(startsAt.getTime());
  });

  it("rejects when the admin session is for a different clinic", async () => {
    const { appointment } = await bookedAppointment();
    const otherClinic = await createClinic();
    const session = makeAdminSession({
      adminUserId: "admin-2",
      clinicId: otherClinic.id,
      doctorId: null,
    });

    await expect(
      rescheduleAppointment(session, {
        locale: "pl",
        id: appointment.id,
        date: "2030-05-13",
        time: "10:00",
      }),
    ).rejects.toBeInstanceOf(BookingNotConfiguredError);
  });
});
