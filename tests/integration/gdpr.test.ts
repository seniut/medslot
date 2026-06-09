import { expect, it } from "vitest";

import { describeDb } from "./db";

import { prisma } from "@/db/prisma";
import { ANONYMIZED_PATIENT } from "@/lib/retention-config";
import {
  AlreadyAnonymizedError,
  PatientHasFutureAppointmentsError,
  PatientNotFoundError,
  anonymizePatient,
} from "@/server/patients/anonymizePatient";
import { retentionSweep } from "@/server/retention/retentionSweep";

import {
  AppointmentStatus,
  createClinic,
  createClinicWithDoctor,
  createPatient,
} from "./factories";

describeDb("anonymizePatient (GDPR/RODO erasure)", () => {
  it("redacts contact data, clears messages and deletes notes", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const patient = await createPatient(clinic.id, {
      firstName: "Real",
      lastName: "Name",
      email: "real.name@example.com",
    });
    await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        doctorId: doctor.id,
        patientId: patient.id,
        startsAt: new Date("2024-01-01T09:00:00Z"),
        endsAt: new Date("2024-01-01T10:00:00Z"),
        status: AppointmentStatus.completed,
        source: "manual_admin",
        patientMessage: "Sensitive note from patient",
      },
    });
    await prisma.doctorNote.create({
      data: {
        clinicId: clinic.id,
        doctorId: doctor.id,
        patientId: patient.id,
        content: "Internal note",
      },
    });

    const result = await anonymizePatient({
      clinicId: clinic.id,
      patientId: patient.id,
      reason: "manual",
    });
    expect(result).toEqual({ notesDeleted: 1, appointmentsRedacted: 1 });

    const updated = await prisma.patient.findUniqueOrThrow({
      where: { id: patient.id },
    });
    expect(updated.firstName).toBe(ANONYMIZED_PATIENT.firstName);
    expect(updated.lastName).toBe(ANONYMIZED_PATIENT.lastName);
    expect(updated.phone).toBe(ANONYMIZED_PATIENT.phone);
    expect(updated.email).toBe(ANONYMIZED_PATIENT.email);
    expect(updated.anonymizedAt).not.toBeNull();

    const appointmentCount = await prisma.appointment.count({
      where: { patientId: patient.id },
    });
    expect(appointmentCount).toBe(1);
    const appointment = await prisma.appointment.findFirstOrThrow({
      where: { patientId: patient.id },
    });
    expect(appointment.patientMessage).toBeNull();

    const noteCount = await prisma.doctorNote.count({
      where: { patientId: patient.id },
    });
    expect(noteCount).toBe(0);
  });

  it("refuses to anonymize a patient with a future booked appointment", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const patient = await createPatient(clinic.id);
    await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        doctorId: doctor.id,
        patientId: patient.id,
        startsAt: new Date(Date.now() + 7 * 86_400_000),
        endsAt: new Date(Date.now() + 7 * 86_400_000 + 3_600_000),
        status: AppointmentStatus.booked,
        source: "manual_admin",
      },
    });

    await expect(
      anonymizePatient({
        clinicId: clinic.id,
        patientId: patient.id,
        reason: "manual",
      }),
    ).rejects.toBeInstanceOf(PatientHasFutureAppointmentsError);
  });

  it("refuses to anonymize an already-anonymized patient", async () => {
    const { clinic } = await createClinicWithDoctor();
    const patient = await createPatient(clinic.id);

    await anonymizePatient({
      clinicId: clinic.id,
      patientId: patient.id,
      reason: "manual",
    });
    await expect(
      anonymizePatient({
        clinicId: clinic.id,
        patientId: patient.id,
        reason: "manual",
      }),
    ).rejects.toBeInstanceOf(AlreadyAnonymizedError);
  });

  it("throws for a patient in another clinic", async () => {
    const { clinic } = await createClinicWithDoctor();
    const patient = await createPatient(clinic.id);
    const otherClinic = await createClinic();

    await expect(
      anonymizePatient({
        clinicId: otherClinic.id,
        patientId: patient.id,
        reason: "manual",
      }),
    ).rejects.toBeInstanceOf(PatientNotFoundError);
  });
});

describeDb("retentionSweep", () => {
  const now = new Date("2030-01-01T00:00:00Z");

  it("anonymizes aged patients and leaves active ones untouched", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();

    const aged = await createPatient(clinic.id, { email: "aged@example.com" });
    await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        doctorId: doctor.id,
        patientId: aged.id,
        startsAt: new Date("2028-06-01T09:00:00Z"),
        endsAt: new Date("2028-06-01T10:00:00Z"),
        status: AppointmentStatus.completed,
        source: "manual_admin",
      },
    });

    const recent = await createPatient(clinic.id, {
      email: "recent@example.com",
    });
    await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        doctorId: doctor.id,
        patientId: recent.id,
        startsAt: new Date("2029-06-01T09:00:00Z"),
        endsAt: new Date("2029-06-01T10:00:00Z"),
        status: AppointmentStatus.completed,
        source: "manual_admin",
      },
    });

    const future = await createPatient(clinic.id, {
      email: "future@example.com",
    });
    await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        doctorId: doctor.id,
        patientId: future.id,
        startsAt: new Date("2030-06-01T09:00:00Z"),
        endsAt: new Date("2030-06-01T10:00:00Z"),
        status: AppointmentStatus.booked,
        source: "manual_admin",
      },
    });

    const summary = await retentionSweep({
      clinicId: clinic.id,
      now,
      retentionMonths: 12,
    });
    expect(summary.scanned).toBe(1);
    expect(summary.anonymized).toBe(1);
    expect(summary.skipped).toBe(0);

    expect(
      (await prisma.patient.findUniqueOrThrow({ where: { id: aged.id } }))
        .anonymizedAt,
    ).not.toBeNull();
    expect(
      (await prisma.patient.findUniqueOrThrow({ where: { id: recent.id } }))
        .anonymizedAt,
    ).toBeNull();
    expect(
      (await prisma.patient.findUniqueOrThrow({ where: { id: future.id } }))
        .anonymizedAt,
    ).toBeNull();
  });

  it("is idempotent across repeated runs", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const aged = await createPatient(clinic.id, { email: "aged@example.com" });
    await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        doctorId: doctor.id,
        patientId: aged.id,
        startsAt: new Date("2028-06-01T09:00:00Z"),
        endsAt: new Date("2028-06-01T10:00:00Z"),
        status: AppointmentStatus.completed,
        source: "manual_admin",
      },
    });

    await retentionSweep({ clinicId: clinic.id, now, retentionMonths: 12 });
    const second = await retentionSweep({
      clinicId: clinic.id,
      now,
      retentionMonths: 12,
    });
    expect(second.scanned).toBe(0);
    expect(second.anonymized).toBe(0);
  });
});
