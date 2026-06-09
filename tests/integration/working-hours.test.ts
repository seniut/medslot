import { expect, it } from "vitest";

import { describeDb } from "./db";

import { prisma } from "@/db/prisma";
import { getDoctorWorkingHours } from "@/server/availability/getWorkingHours";
import { updateDoctorWorkingHours } from "@/server/availability/updateWorkingHours";

import {
  allWeekHours,
  createClinic,
  createClinicWithDoctor,
  makeAdminSession,
  weekdayHours,
} from "./factories";

describeDb("doctor working hours", () => {
  it("saves and reads back seven weekday rows", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const session = makeAdminSession({
      adminUserId: "admin-1",
      clinicId: clinic.id,
      doctorId: doctor.id,
    });

    await updateDoctorWorkingHours(session, doctor.id, weekdayHours());

    const rows = await getDoctorWorkingHours({
      clinicId: clinic.id,
      doctorId: doctor.id,
    });
    expect(rows).toHaveLength(7);

    const monday = rows.find((row) => row.dayOfWeek === 1);
    expect(monday).toMatchObject({
      isActive: true,
      startTime: "09:00",
      endTime: "17:00",
    });
    expect(rows.find((row) => row.dayOfWeek === 6)?.isActive).toBe(false);
    expect(rows.find((row) => row.dayOfWeek === 7)?.isActive).toBe(false);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: doctor.id, action: "working_hours.updated" },
    });
    expect(audit).not.toBeNull();
  });

  it("replaces all rows on each save", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const session = makeAdminSession({
      adminUserId: "admin-1",
      clinicId: clinic.id,
      doctorId: doctor.id,
    });

    await updateDoctorWorkingHours(session, doctor.id, allWeekHours());
    await updateDoctorWorkingHours(session, doctor.id, weekdayHours());

    const count = await prisma.workingHour.count({
      where: { clinicId: clinic.id, doctorId: doctor.id },
    });
    expect(count).toBe(7);

    const rows = await getDoctorWorkingHours({
      clinicId: clinic.id,
      doctorId: doctor.id,
    });
    expect(rows.find((row) => row.dayOfWeek === 6)?.isActive).toBe(false);
  });

  it("reads working hours scoped to the clinic", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const session = makeAdminSession({
      adminUserId: "admin-1",
      clinicId: clinic.id,
      doctorId: doctor.id,
    });
    await updateDoctorWorkingHours(session, doctor.id, allWeekHours());

    const otherClinic = await createClinic();
    const rows = await getDoctorWorkingHours({
      clinicId: otherClinic.id,
      doctorId: doctor.id,
    });
    expect(rows).toHaveLength(7);
    expect(rows.every((row) => row.isActive === false)).toBe(true);
  });
});
