import { expect, it } from "vitest";

import { describeDb } from "./db";

import { prisma } from "@/db/prisma";
import { BOOKING_DEFAULTS } from "@/lib/booking-config";
import { isoDayOfWeek } from "@/lib/date-time/timezone";
import { getAvailability } from "@/server/appointments/getAvailability";

import {
  allWeekHours,
  createAppointment,
  createClinicWithDoctor,
  createPatient,
  setWorkingHours,
  weekdayHours,
} from "./factories";

const TIME_ZONE = "Europe/Warsaw";
// A fixed reference instant (07:00 local CEST) so slot expectations are stable.
const NOW = new Date("2026-06-10T05:00:00Z");

describeDb("getAvailability", () => {
  it("returns the full booking window with correctly sized slots", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    await setWorkingHours(clinic.id, doctor.id, allWeekHours());

    const days = await getAvailability({
      clinicId: clinic.id,
      doctorId: doctor.id,
      timeZone: TIME_ZONE,
      now: NOW,
    });

    expect(days).toHaveLength(BOOKING_DEFAULTS.bookingWindowDays);

    const slots = days.flatMap((day) => day.slots);
    expect(slots.length).toBeGreaterThan(0);

    const earliest = new Date(slots[0].startsAt).getTime();
    expect(earliest).toBeGreaterThanOrEqual(
      NOW.getTime() + BOOKING_DEFAULTS.minNoticeHours * 3_600_000,
    );

    const durationMs =
      new Date(slots[0].endsAt).getTime() -
      new Date(slots[0].startsAt).getTime();
    expect(durationMs).toBe(BOOKING_DEFAULTS.durationMinutes * 60_000);
  });

  it("offers no slots on inactive weekdays", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    await setWorkingHours(clinic.id, doctor.id, weekdayHours());

    const days = await getAvailability({
      clinicId: clinic.id,
      doctorId: doctor.id,
      timeZone: TIME_ZONE,
      now: NOW,
    });

    for (const day of days) {
      const [year, month, dayOfMonth] = day.date.split("-").map(Number);
      const weekday = isoDayOfWeek(year, month, dayOfMonth);
      if (weekday >= 6) {
        expect(day.slots).toHaveLength(0);
      } else {
        expect(day.slots.length).toBeGreaterThan(0);
      }
    }
  });

  it("excludes slots overlapping a blocked time", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    await setWorkingHours(clinic.id, doctor.id, allWeekHours());

    const before = await getAvailability({
      clinicId: clinic.id,
      doctorId: doctor.id,
      timeZone: TIME_ZONE,
      now: NOW,
    });
    const target = before.find((day) => day.slots.length > 1);
    expect(target).toBeDefined();

    await prisma.blockedTime.create({
      data: {
        clinicId: clinic.id,
        doctorId: doctor.id,
        startsAt: new Date(target!.slots[0].startsAt),
        endsAt: new Date(target!.slots[target!.slots.length - 1].endsAt),
      },
    });

    const after = await getAvailability({
      clinicId: clinic.id,
      doctorId: doctor.id,
      timeZone: TIME_ZONE,
      now: NOW,
    });
    const afterDay = after.find((day) => day.date === target!.date);
    expect(afterDay?.slots).toHaveLength(0);
  });

  it("excludes a slot that is already booked", async () => {
    const { clinic, doctor } = await createClinicWithDoctor();
    await setWorkingHours(clinic.id, doctor.id, allWeekHours());

    const before = await getAvailability({
      clinicId: clinic.id,
      doctorId: doctor.id,
      timeZone: TIME_ZONE,
      now: NOW,
    });
    const target = before.find((day) => day.slots.length > 2);
    expect(target).toBeDefined();
    const slot = target!.slots[1];

    const patient = await createPatient(clinic.id);
    await createAppointment({
      clinicId: clinic.id,
      doctorId: doctor.id,
      patientId: patient.id,
      startsAt: new Date(slot.startsAt),
      endsAt: new Date(slot.endsAt),
    });

    const after = await getAvailability({
      clinicId: clinic.id,
      doctorId: doctor.id,
      timeZone: TIME_ZONE,
      now: NOW,
    });
    const afterDay = after.find((day) => day.date === target!.date);
    expect(
      afterDay?.slots.some((each) => each.startsAt === slot.startsAt),
    ).toBe(false);
  });
});
