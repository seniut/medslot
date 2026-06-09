import type { AppointmentSource, AppointmentStatus } from "@prisma/client";

import { prisma } from "@/db/prisma";
import { shiftIsoDate, zonedWallTimeToUtc } from "@/lib/date-time/timezone";

export type AdminCalendarAppointment = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  source: AppointmentSource;
  patientFirstName: string;
  patientLastName: string;
  patientPhone: string;
};

export type GetAdminCalendarDayParams = {
  clinicId: string;
  timeZone: string;
  /** Clinic-local calendar date, "YYYY-MM-DD". */
  date: string;
};

/**
 * Load a single clinic-local day of appointments for the admin calendar.
 *
 * Returns every status (so the doctor sees the full day, including cancelled
 * and completed visits) ordered by start time. Strictly clinic-scoped. Patient
 * names/phone are included because this is an authenticated admin read.
 */
export async function getAdminCalendarDay({
  clinicId,
  timeZone,
  date,
}: GetAdminCalendarDayParams): Promise<AdminCalendarAppointment[]> {
  const [year, month, day] = date.split("-").map(Number);
  const dayStart = zonedWallTimeToUtc(timeZone, {
    year,
    month,
    day,
    hour: 0,
    minute: 0,
  });
  const nextDate = shiftIsoDate(date, 1);
  const [nextYear, nextMonth, nextDay] = nextDate.split("-").map(Number);
  const dayEnd = zonedWallTimeToUtc(timeZone, {
    year: nextYear,
    month: nextMonth,
    day: nextDay,
    hour: 0,
    minute: 0,
  });

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId,
      startsAt: { gte: dayStart, lt: dayEnd },
    },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      source: true,
      patient: { select: { firstName: true, lastName: true, phone: true } },
    },
  });

  return appointments.map((appointment) => ({
    id: appointment.id,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    status: appointment.status,
    source: appointment.source,
    patientFirstName: appointment.patient.firstName,
    patientLastName: appointment.patient.lastName,
    patientPhone: appointment.patient.phone,
  }));
}
