import { prisma } from "@/db/prisma";
import { WEEKDAYS } from "@/lib/validation/workingHoursSchema";

export type WeekdayHours = {
  dayOfWeek: number;
  isActive: boolean;
  /** "HH:MM" wall-clock time in the clinic timezone. */
  startTime: string;
  /** "HH:MM" wall-clock time in the clinic timezone. */
  endTime: string;
};

const DEFAULT_START = "09:00";
const DEFAULT_END = "17:00";

/**
 * Load the doctor's working hours as exactly seven weekday rows (Mon–Sun).
 *
 * The data model allows multiple windows per weekday; the MVP editor shows one,
 * so this uses the first window per day and synthesizes an inactive default for
 * any weekday without a stored row. Clinic-scoped.
 */
export async function getDoctorWorkingHours({
  clinicId,
  doctorId,
}: {
  clinicId: string;
  doctorId: string;
}): Promise<WeekdayHours[]> {
  const rows = await prisma.workingHour.findMany({
    where: { clinicId, doctorId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    select: { dayOfWeek: true, isActive: true, startTime: true, endTime: true },
  });

  const firstByDay = new Map<number, (typeof rows)[number]>();
  for (const row of rows) {
    if (!firstByDay.has(row.dayOfWeek)) {
      firstByDay.set(row.dayOfWeek, row);
    }
  }

  return WEEKDAYS.map((dayOfWeek) => {
    const row = firstByDay.get(dayOfWeek);
    return row
      ? {
          dayOfWeek,
          isActive: row.isActive,
          startTime: row.startTime,
          endTime: row.endTime,
        }
      : {
          dayOfWeek,
          isActive: false,
          startTime: DEFAULT_START,
          endTime: DEFAULT_END,
        };
  });
}
