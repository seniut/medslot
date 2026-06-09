import { expect, it } from "vitest";

import { describeDb } from "./db";

import { prisma } from "@/db/prisma";
import { findOrCreatePatient } from "@/server/patients/findOrCreatePatient";
import { getPatientDetail } from "@/server/patients/getPatientDetail";
import { listPatients } from "@/server/patients/getPatients";

import {
  AppointmentStatus,
  createAppointment,
  createClinic,
  createClinicWithDoctor,
  createPatient,
} from "./factories";

describeDb("patient read models", () => {
  it("lists clinic patients with visit count and last visit, ordered by name", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();

    const borg = await createPatient(clinic.id, {
      lastName: "Borg",
      firstName: "Bea",
      email: "borg@example.com",
    });
    const adams = await createPatient(clinic.id, {
      lastName: "Adams",
      firstName: "Ada",
      email: "adams@example.com",
    });
    await createAppointment({
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: borg.id,
      startsAt: new Date("2025-01-01T09:00:00Z"),
      endsAt: new Date("2025-01-01T10:00:00Z"),
      status: AppointmentStatus.completed,
    });
    await createAppointment({
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: borg.id,
      startsAt: new Date("2025-06-01T09:00:00Z"),
      endsAt: new Date("2025-06-01T10:00:00Z"),
      status: AppointmentStatus.completed,
    });

    const otherClinic = await createClinic();
    await createPatient(otherClinic.id, { email: "other@example.com" });

    const patients = await listPatients({ clinicId: clinic.id });
    expect(patients).toHaveLength(2);
    expect(patients[0].lastName).toBe("Adams");
    expect(patients[0].id).toBe(adams.id);
    expect(patients[0].visitCount).toBe(0);
    expect(patients[0].lastVisitAt).toBeNull();
    expect(patients[1].lastName).toBe("Borg");
    expect(patients[1].visitCount).toBe(2);
    expect(patients[1].lastVisitAt?.toISOString()).toBe(
      "2025-06-01T09:00:00.000Z",
    );
  });

  it("returns full patient detail with visits and notes newest first", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const patient = await createPatient(clinic.id);

    await createAppointment({
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: patient.id,
      startsAt: new Date("2025-01-01T09:00:00Z"),
      endsAt: new Date("2025-01-01T10:00:00Z"),
      status: AppointmentStatus.completed,
    });
    await createAppointment({
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: patient.id,
      startsAt: new Date("2025-06-01T09:00:00Z"),
      endsAt: new Date("2025-06-01T10:00:00Z"),
      status: AppointmentStatus.completed,
    });
    await prisma.doctorNote.create({
      data: {
        clinicId: clinic.id,
        doctorId: doctor.id,
        patientId: patient.id,
        content: "First note",
      },
    });
    await prisma.doctorNote.create({
      data: {
        clinicId: clinic.id,
        doctorId: doctor.id,
        patientId: patient.id,
        content: "Second note",
      },
    });

    const detail = await getPatientDetail({
      clinicId: clinic.id,
      patientId: patient.id,
    });
    expect(detail).not.toBeNull();
    expect(detail?.anonymizedAt).toBeNull();
    expect(detail?.visits).toHaveLength(2);
    expect(detail!.visits[0].startsAt.getTime()).toBeGreaterThan(
      detail!.visits[1].startsAt.getTime(),
    );
    expect(detail?.notes).toHaveLength(2);
    expect(detail!.notes[0].createdAt.getTime()).toBeGreaterThanOrEqual(
      detail!.notes[1].createdAt.getTime(),
    );
  });

  it("returns null for a patient in another clinic", async () => {
    const { clinic } = await createClinicWithDoctor();
    const patient = await createPatient(clinic.id);
    const otherClinic = await createClinic();

    const detail = await getPatientDetail({
      clinicId: otherClinic.id,
      patientId: patient.id,
    });
    expect(detail).toBeNull();
  });

  it("deduplicates patients by email or phone within a clinic", async () => {
    const { clinic } = await createClinicWithDoctor();
    const otherClinic = await createClinic();
    const base = {
      firstName: "Jan",
      lastName: "Kowalski",
    };

    const a = await prisma.$transaction((tx) =>
      findOrCreatePatient(tx, clinic.id, {
        ...base,
        phone: "+48111000111",
        email: "dup@example.com",
      }),
    );
    const sameEmail = await prisma.$transaction((tx) =>
      findOrCreatePatient(tx, clinic.id, {
        ...base,
        phone: "+48999000999",
        email: "dup@example.com",
      }),
    );
    const samePhone = await prisma.$transaction((tx) =>
      findOrCreatePatient(tx, clinic.id, {
        ...base,
        phone: "+48111000111",
        email: "fresh@example.com",
      }),
    );
    const brandNew = await prisma.$transaction((tx) =>
      findOrCreatePatient(tx, clinic.id, {
        ...base,
        phone: "+48222000222",
        email: "new@example.com",
      }),
    );
    const otherClinicSame = await prisma.$transaction((tx) =>
      findOrCreatePatient(tx, otherClinic.id, {
        ...base,
        phone: "+48111000111",
        email: "dup@example.com",
      }),
    );

    expect(sameEmail.id).toBe(a.id);
    expect(samePhone.id).toBe(a.id);
    expect(brandNew.id).not.toBe(a.id);
    expect(otherClinicSame.id).not.toBe(a.id);
  });
});
