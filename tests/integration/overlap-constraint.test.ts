import { expect, it } from "vitest";

import { describeDb } from "./db";

import { isNoOverlapViolation } from "@/server/appointments/overlap";

import {
  AppointmentStatus,
  createClinicWithDoctor,
  createDoctor,
  createPatient,
  createAppointment,
} from "./factories";

/**
 * These tests exercise the PostgreSQL `appointment_no_overlap` exclusion
 * constraint directly (bypassing the availability engine) to prove that
 * double-booking is prevented at the database level, which is the final
 * authority per the domain rules.
 */
describeDb("appointment_no_overlap database constraint", () => {
  const start = new Date("2030-01-10T10:00:00Z");
  const end = new Date("2030-01-10T11:00:00Z");

  it("rejects an overlapping booked appointment", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const patient = await createPatient(clinic.id);

    await createAppointment({
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: patient.id,
      startsAt: start,
      endsAt: end,
    });

    let caught: unknown;
    try {
      await createAppointment({
        clinicId: clinic.id,
        doctorId: doctor.id,
        patientId: patient.id,
        startsAt: new Date("2030-01-10T10:30:00Z"),
        endsAt: new Date("2030-01-10T11:30:00Z"),
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeDefined();
    expect(isNoOverlapViolation(caught)).toBe(true);
  });

  it("allows an adjacent appointment that does not overlap", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const patient = await createPatient(clinic.id);

    await createAppointment({
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: patient.id,
      startsAt: start,
      endsAt: end,
    });

    const adjacent = await createAppointment({
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: patient.id,
      startsAt: end,
      endsAt: new Date("2030-01-10T12:00:00Z"),
    });
    expect(adjacent.id).toBeTypeOf("string");
  });

  it("allows an overlapping appointment when the existing one is cancelled", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const patient = await createPatient(clinic.id);

    await createAppointment({
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: patient.id,
      startsAt: start,
      endsAt: end,
      status: AppointmentStatus.cancelled_by_patient,
    });

    const overlapping = await createAppointment({
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: patient.id,
      startsAt: new Date("2030-01-10T10:30:00Z"),
      endsAt: new Date("2030-01-10T11:30:00Z"),
    });
    expect(overlapping.id).toBeTypeOf("string");
  });

  it("allows overlapping appointments for different doctors", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const otherDoctor = await createDoctor(clinic.id);
    const patient = await createPatient(clinic.id);

    await createAppointment({
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: patient.id,
      startsAt: start,
      endsAt: end,
    });

    const otherDoctorVisit = await createAppointment({
      clinicId: clinic.id,
      doctorId: otherDoctor.id,
      patientId: patient.id,
      startsAt: start,
      endsAt: end,
    });
    expect(otherDoctorVisit.id).toBeTypeOf("string");
  });
});
