import { expect, it } from "vitest";

import { describeDb } from "./db";

import { prisma } from "@/db/prisma";
import { zonedWallTimeToUtc } from "@/lib/date-time/timezone";
import { createDoctorBlockedTime } from "@/server/availability/createBlockedTime";
import { deleteDoctorBlockedTime } from "@/server/availability/deleteBlockedTime";
import { getUpcomingBlockedTimes } from "@/server/availability/getBlockedTimes";

import {
  createClinic,
  createClinicWithDoctor,
  makeAdminSession,
} from "./factories";

const TIME_ZONE = "Europe/Warsaw";

describeDb("blocked time", () => {
  it("creates a blocked time stored as UTC instants with audit", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const session = makeAdminSession({
      adminUserId: "admin-1",
      clinicId: clinic.id,
      doctorId: doctor.id,
    });

    const { id } = await createDoctorBlockedTime(session, {
      doctorId: doctor.id,
      timeZone: TIME_ZONE,
      input: {
        locale: "pl",
        date: "2030-07-01",
        startTime: "09:00",
        endTime: "12:00",
        reason: "Konferencja",
      },
    });

    const row = await prisma.blockedTime.findUniqueOrThrow({ where: { id } });
    expect(row.startsAt.getTime()).toBe(
      zonedWallTimeToUtc(TIME_ZONE, {
        year: 2030,
        month: 7,
        day: 1,
        hour: 9,
        minute: 0,
      }).getTime(),
    );
    expect(row.endsAt.getTime()).toBe(
      zonedWallTimeToUtc(TIME_ZONE, {
        year: 2030,
        month: 7,
        day: 1,
        hour: 12,
        minute: 0,
      }).getTime(),
    );

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: id, action: "blocked_time.created" },
    });
    expect(audit).not.toBeNull();
  });

  it("lists only upcoming blocked times in chronological order", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const now = new Date("2030-07-01T00:00:00Z");

    await prisma.blockedTime.createMany({
      data: [
        {
          clinicId: clinic.id,
          doctorId: doctor.id,
          startsAt: new Date("2029-01-01T09:00:00Z"),
          endsAt: new Date("2029-01-01T10:00:00Z"),
        },
        {
          clinicId: clinic.id,
          doctorId: doctor.id,
          startsAt: new Date("2030-09-01T09:00:00Z"),
          endsAt: new Date("2030-09-01T10:00:00Z"),
        },
        {
          clinicId: clinic.id,
          doctorId: doctor.id,
          startsAt: new Date("2030-08-01T09:00:00Z"),
          endsAt: new Date("2030-08-01T10:00:00Z"),
        },
      ],
    });

    const upcoming = await getUpcomingBlockedTimes({
      clinicId: clinic.id,
      doctorId: doctor.id,
      now,
    });
    expect(upcoming).toHaveLength(2);
    expect(upcoming[0].startsAt.getTime()).toBeLessThan(
      upcoming[1].startsAt.getTime(),
    );
    expect(upcoming[0].startsAt.toISOString()).toBe("2030-08-01T09:00:00.000Z");
  });

  it("deletes a blocked time only within the owning clinic", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    const block = await prisma.blockedTime.create({
      data: {
        clinicId: clinic.id,
        doctorId: doctor.id,
        startsAt: new Date("2030-08-01T09:00:00Z"),
        endsAt: new Date("2030-08-01T10:00:00Z"),
      },
    });

    const otherClinic = await createClinic();
    const otherSession = makeAdminSession({
      adminUserId: "admin-other",
      clinicId: otherClinic.id,
      doctorId: null,
    });
    await deleteDoctorBlockedTime(otherSession, block.id);
    expect(
      await prisma.blockedTime.findUnique({ where: { id: block.id } }),
    ).not.toBeNull();

    const ownerSession = makeAdminSession({
      adminUserId: "admin-1",
      clinicId: clinic.id,
      doctorId: doctor.id,
    });
    await deleteDoctorBlockedTime(ownerSession, block.id);
    expect(
      await prisma.blockedTime.findUnique({ where: { id: block.id } }),
    ).toBeNull();

    const deleteAudits = await prisma.auditLog.count({
      where: { entityId: block.id, action: "blocked_time.deleted" },
    });
    expect(deleteAudits).toBe(1);
  });
});
