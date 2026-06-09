import { prisma } from "@/db/prisma";
import type { BlockedTimeInput } from "@/lib/validation/blockedTimeSchema";
import { zonedWallTimeToUtc } from "@/lib/date-time/timezone";
import { logAuditEvent } from "@/server/audit/logAuditEvent";
import type { AdminSession } from "@/server/auth/getAdminSession";

/**
 * Create a blocked-time interval for the doctor.
 *
 * The date and start/end wall-clock times are interpreted in the clinic
 * timezone and stored as absolute UTC instants, so blocked time lines up with
 * appointments and survives DST. Clinic-scoped and audited. The reason is not
 * written to the audit log (it is free text).
 */
export async function createDoctorBlockedTime(
  session: AdminSession,
  params: { doctorId: string; timeZone: string; input: BlockedTimeInput },
): Promise<{ id: string }> {
  const { doctorId, timeZone, input } = params;

  const [year, month, day] = input.date.split("-").map(Number);
  const [startHour, startMinute] = input.startTime.split(":").map(Number);
  const [endHour, endMinute] = input.endTime.split(":").map(Number);

  const startsAt = zonedWallTimeToUtc(timeZone, {
    year,
    month,
    day,
    hour: startHour,
    minute: startMinute,
  });
  const endsAt = zonedWallTimeToUtc(timeZone, {
    year,
    month,
    day,
    hour: endHour,
    minute: endMinute,
  });

  const created = await prisma.blockedTime.create({
    data: {
      clinicId: session.clinicId,
      doctorId,
      startsAt,
      endsAt,
      reason: input.reason ?? null,
    },
    select: { id: true },
  });

  await logAuditEvent({
    clinicId: session.clinicId,
    actorType: "doctor",
    actorUserId: session.adminUserId,
    action: "blocked_time.created",
    entityType: "blocked_time",
    entityId: created.id,
  });

  return created;
}
