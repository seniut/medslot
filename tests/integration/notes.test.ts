import { expect, it } from "vitest";

import { describeDb } from "./db";

import { prisma } from "@/db/prisma";
import {
  NoteTargetNotFoundError,
  createDoctorNote,
} from "@/server/notes/createNote";

import {
  createAppointment,
  createClinic,
  createClinicWithDoctor,
  createPatient,
  makeAdminSession,
} from "./factories";

describeDb("createDoctorNote", () => {
  it("creates an internal note for a clinic patient with audit", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const patient = await createPatient(clinic.id);
    const session = makeAdminSession({
      adminUserId: "admin-1",
      clinicId: clinic.id,
      doctorId: doctor.id,
    });

    const { id } = await createDoctorNote(session, {
      patientId: patient.id,
      content: "Blood pressure normal",
    });

    const note = await prisma.doctorNote.findUniqueOrThrow({ where: { id } });
    expect(note.clinicId).toBe(clinic.id);
    expect(note.doctorId).toBe(doctor.id);
    expect(note.patientId).toBe(patient.id);
    expect(note.content).toBe("Blood pressure normal");
    expect(note.appointmentId).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: id, action: "note.created" },
    });
    expect(audit).not.toBeNull();
    expect((audit?.metadata as { hasAppointment?: boolean })?.hasAppointment).toBe(
      false,
    );
  });

  it("links a note to an appointment in the same clinic", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const patient = await createPatient(clinic.id);
    const appointment = await createAppointment({
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: patient.id,
      startsAt: new Date("2030-02-02T09:00:00Z"),
      endsAt: new Date("2030-02-02T10:00:00Z"),
    });
    const session = makeAdminSession({
      adminUserId: "admin-1",
      clinicId: clinic.id,
      doctorId: doctor.id,
    });

    const { id } = await createDoctorNote(session, {
      patientId: patient.id,
      appointmentId: appointment.id,
      content: "Follow-up scheduled",
    });

    const note = await prisma.doctorNote.findUniqueOrThrow({ where: { id } });
    expect(note.appointmentId).toBe(appointment.id);
  });

  it("rejects a note for a patient in another clinic", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const otherClinic = await createClinic();
    const otherPatient = await createPatient(otherClinic.id);
    const session = makeAdminSession({
      adminUserId: "admin-1",
      clinicId: clinic.id,
      doctorId: doctor.id,
    });

    await expect(
      createDoctorNote(session, {
        patientId: otherPatient.id,
        content: "Should fail",
      }),
    ).rejects.toBeInstanceOf(NoteTargetNotFoundError);
  });

  it("rejects a note whose appointment belongs to another clinic", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const patient = await createPatient(clinic.id);
    const otherClinicWithDoctor = await createClinicWithDoctor();
    const otherPatient = await createPatient(otherClinicWithDoctor.clinic.id);
    const foreignAppointment = await createAppointment({
      clinicId: otherClinicWithDoctor.clinic.id,
      doctorId: otherClinicWithDoctor.doctor.id,
      patientId: otherPatient.id,
      startsAt: new Date("2030-02-02T09:00:00Z"),
      endsAt: new Date("2030-02-02T10:00:00Z"),
    });
    const session = makeAdminSession({
      adminUserId: "admin-1",
      clinicId: clinic.id,
      doctorId: doctor.id,
    });

    await expect(
      createDoctorNote(session, {
        patientId: patient.id,
        appointmentId: foreignAppointment.id,
        content: "Should fail",
      }),
    ).rejects.toBeInstanceOf(NoteTargetNotFoundError);
  });

  it("resolves the bookable doctor when the session has no doctorId", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const patient = await createPatient(clinic.id);
    const session = makeAdminSession({
      adminUserId: "admin-1",
      clinicId: clinic.id,
      doctorId: null,
    });

    const { id } = await createDoctorNote(session, {
      patientId: patient.id,
      content: "Owner-authored note",
    });

    const note = await prisma.doctorNote.findUniqueOrThrow({ where: { id } });
    expect(note.doctorId).toBe(doctor.id);
  });
});
