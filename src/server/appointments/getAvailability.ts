import { prisma } from "@/db/prisma";
import { BOOKING_DEFAULTS } from "@/lib/booking-config";
import {
  overlapsAny,
  parseHhMm,
  type Interval,
} from "@/lib/date-time/intervals";
import {
  enumerateZonedDates,
  isoDayOfWeek,
  zonedWallTimeToUtc,
} from "@/lib/date-time/timezone";

export type Slot = {
  /** ISO instant of the slot start. */
  startsAt: string;
  /** ISO instant of the slot end. */
  endsAt: string;
};

export type DayAvailability = {
  /** ISO calendar date in the clinic timezone, e.g. "2026-06-12". */
  date: string;
  slots: Slot[];
};

export type GetAvailabilityParams = {
  clinicId: string;
  doctorId: string;
  timeZone: string;
  now?: Date;
};

/**
 * Compute bookable slots per day for the booking window.
 *
 * Availability is derived from working hours, blocked time, and existing
 * `booked` appointments. No patient data is read or returned — only free time
 * intervals — so this is safe to expose on the public booking page.
 */
export async function getAvailability({
  clinicId,
  doctorId,
  timeZone,
  now = new Date(),
}: GetAvailabilityParams): Promise<DayAvailability[]> {
  const { durationMinutes, slotStepMinutes, minNoticeHours, bookingWindowDays } =
    BOOKING_DEFAULTS;

  const days = enumerateZonedDates(timeZone, now, bookingWindowDays);
  const rangeEnd = new Date(now.getTime() + (bookingWindowDays + 1) * 86_400_000);
  const earliestStart = new Date(now.getTime() + minNoticeHours * 3_600_000);

  const [workingHours, blockedTimes, bookedAppointments] = await Promise.all([
    prisma.workingHour.findMany({
      where: { clinicId, doctorId, isActive: true },
    }),
    prisma.blockedTime.findMany({
      where: { clinicId, doctorId, startsAt: { lt: rangeEnd }, endsAt: { gt: now } },
      select: { startsAt: true, endsAt: true },
    }),
    prisma.appointment.findMany({
      where: {
        clinicId,
        doctorId,
        status: "booked",
        startsAt: { lt: rangeEnd },
        endsAt: { gt: now },
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const blockedIntervals: Interval[] = blockedTimes.map((item) => ({
    start: item.startsAt,
    end: item.endsAt,
  }));
  const bookedIntervals: Interval[] = bookedAppointments.map((item) => ({
    start: item.startsAt,
    end: item.endsAt,
  }));

  const windowsByWeekday = new Map<number, typeof workingHours>();
  for (const workingHour of workingHours) {
    const list = windowsByWeekday.get(workingHour.dayOfWeek) ?? [];
    list.push(workingHour);
    windowsByWeekday.set(workingHour.dayOfWeek, list);
  }

  const result: DayAvailability[] = [];

  for (const day of days) {
    const weekday = isoDayOfWeek(day.year, day.month, day.day);
    const windows = windowsByWeekday.get(weekday) ?? [];
    const seenStarts = new Set<number>();
    const slots: Slot[] = [];

    for (const window of windows) {
      const startMinute = parseHhMm(window.startTime);
      const endMinute = parseHhMm(window.endTime);

      for (
        let minute = startMinute;
        minute + durationMinutes <= endMinute;
        minute += slotStepMinutes
      ) {
        const start = zonedWallTimeToUtc(timeZone, {
          year: day.year,
          month: day.month,
          day: day.day,
          hour: Math.floor(minute / 60),
          minute: minute % 60,
        });

        if (seenStarts.has(start.getTime())) {
          continue;
        }
        if (start < earliestStart || start >= rangeEnd) {
          continue;
        }

        const end = new Date(start.getTime() + durationMinutes * 60_000);
        const candidate: Interval = { start, end };

        if (
          overlapsAny(candidate, blockedIntervals) ||
          overlapsAny(candidate, bookedIntervals)
        ) {
          continue;
        }

        seenStarts.add(start.getTime());
        slots.push({ startsAt: start.toISOString(), endsAt: end.toISOString() });
      }
    }

    slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    result.push({ date: day.dateString, slots });
  }

  return result;
}
