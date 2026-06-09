import { expect, it } from "vitest";

import { describeDb } from "./db";

import { prisma } from "@/db/prisma";
import { exportAppointmentsForRange } from "@/server/export/exportAppointments";

import {
  createAppointment,
  createClinicWithDoctor,
  createPatient,
  makeAdminSession,
} from "./factories";

const TIME_ZONE = "Europe/Warsaw";

describeDb("exportAppointmentsForRange", () => {
  it("exports visits within the range as CSV with clinic-local times", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const session = makeAdminSession({
      adminUserId: "admin-1",
      clinicId: clinic.id,
      doctorId: doctor.id,
    });

    const adams = await createPatient(clinic.id, {
      firstName: "Ada",
      lastName: "Adams",
      email: "adams@example.com",
    });
    const borg = await createPatient(clinic.id, {
      firstName: "Bea",
      lastName: "Borg",
      email: "borg@example.com",
    });
    // 2026-06-01 10:00 Europe/Warsaw (CEST = UTC+2) -> 08:00Z
    await createAppointment({
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: adams.id,
      startsAt: new Date("2026-06-01T08:00:00Z"),
      endsAt: new Date("2026-06-01T09:00:00Z"),
    });
    await createAppointment({
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: borg.id,
      startsAt: new Date("2026-06-02T12:00:00Z"),
      endsAt: new Date("2026-06-02T13:00:00Z"),
    });
    // Outside the range, must be excluded.
    await createAppointment({
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: adams.id,
      startsAt: new Date("2026-06-10T08:00:00Z"),
      endsAt: new Date("2026-06-10T09:00:00Z"),
    });

    const result = await exportAppointmentsForRange(session, {
      from: "2026-06-01",
      to: "2026-06-02",
      timeZone: TIME_ZONE,
    });

    expect(result.count).toBe(2);
    const lines = result.csv.split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      "date,start,end,first_name,last_name,phone,email,status,source",
    );
    expect(result.csv).toContain("2026-06-01");
    expect(result.csv).toContain("10:00");
    expect(result.csv).toContain("Adams");

    const audit = await prisma.auditLog.findFirst({
      where: { clinicId: clinic.id, action: "export.appointments_csv" },
    });
    expect(audit).not.toBeNull();
    expect((audit?.metadata as { count?: number })?.count).toBe(2);
  });

  it("neutralizes spreadsheet formula injection in patient fields", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const session = makeAdminSession({
      adminUserId: "admin-1",
      clinicId: clinic.id,
      doctorId: doctor.id,
    });
    const malicious = await createPatient(clinic.id, {
      firstName: "Eve",
      lastName: "=1+1",
      email: "eve@example.com",
    });
    await createAppointment({
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: malicious.id,
      startsAt: new Date("2026-06-01T08:00:00Z"),
      endsAt: new Date("2026-06-01T09:00:00Z"),
    });

    const result = await exportAppointmentsForRange(session, {
      from: "2026-06-01",
      to: "2026-06-01",
      timeZone: TIME_ZONE,
    });

    expect(result.count).toBe(1);
    expect(result.csv).toContain("'=1+1");
  });
});
