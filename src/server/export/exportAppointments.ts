import { prisma } from "@/db/prisma";
import { buildCsv } from "@/lib/csv";
import { shiftIsoDate, zonedWallTimeToUtc } from "@/lib/date-time/timezone";
import { logAuditEvent } from "@/server/audit/logAuditEvent";
import type { AdminSession } from "@/server/auth/getAdminSession";

const CSV_HEADERS = [
  "date",
  "start",
  "end",
  "first_name",
  "last_name",
  "phone",
  "email",
  "status",
  "source",
];

/** Clinic-local calendar date as "YYYY-MM-DD". */
function formatLocalDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Clinic-local 24-hour wall-clock time as "HH:MM". */
function formatLocalTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export type ExportResult = {
  csv: string;
  count: number;
};

export type ExportParams = {
  from: string;
  to: string;
  timeZone: string;
};

/**
 * Build a CSV of the clinic's visits within an inclusive clinic-local date
 * range, strictly clinic-scoped and audited.
 *
 * Every status is included (so the export is a faithful operational record);
 * dates/times are rendered in the clinic timezone. Patient contact details are
 * included because this is an authenticated admin export — but the export is
 * audited and only the range and row count (never patient data) are logged.
 * Internal notes are intentionally excluded from the CSV.
 */
export async function exportAppointmentsForRange(
  session: AdminSession,
  { from, to, timeZone }: ExportParams,
): Promise<ExportResult> {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const rangeStart = zonedWallTimeToUtc(timeZone, {
    year: fromYear,
    month: fromMonth,
    day: fromDay,
    hour: 0,
    minute: 0,
  });

  // The range is inclusive of `to`, so the upper bound is the start of the next day.
  const dayAfterTo = shiftIsoDate(to, 1);
  const [toYear, toMonth, toDay] = dayAfterTo.split("-").map(Number);
  const rangeEnd = zonedWallTimeToUtc(timeZone, {
    year: toYear,
    month: toMonth,
    day: toDay,
    hour: 0,
    minute: 0,
  });

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId: session.clinicId,
      startsAt: { gte: rangeStart, lt: rangeEnd },
    },
    orderBy: { startsAt: "asc" },
    select: {
      startsAt: true,
      endsAt: true,
      status: true,
      source: true,
      patient: {
        select: { firstName: true, lastName: true, phone: true, email: true },
      },
    },
  });

  const rows = appointments.map((appointment) => [
    formatLocalDate(appointment.startsAt, timeZone),
    formatLocalTime(appointment.startsAt, timeZone),
    formatLocalTime(appointment.endsAt, timeZone),
    appointment.patient.firstName,
    appointment.patient.lastName,
    appointment.patient.phone,
    appointment.patient.email,
    appointment.status,
    appointment.source,
  ]);

  const csv = buildCsv(CSV_HEADERS, rows);

  await logAuditEvent({
    clinicId: session.clinicId,
    actorType: "doctor",
    actorUserId: session.adminUserId,
    action: "export.appointments_csv",
    entityType: "export",
    entityId: `${from}_${to}`,
    metadata: { from, to, count: appointments.length },
  });

  return { csv, count: appointments.length };
}
