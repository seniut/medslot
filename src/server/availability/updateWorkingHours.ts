import { prisma } from "@/db/prisma";
import type { WorkingDayInput } from "@/lib/validation/workingHoursSchema";
import { logAuditEvent } from "@/server/audit/logAuditEvent";
import type { AdminSession } from "@/server/auth/getAdminSession";

/**
 * Replace the doctor's working hours with the submitted weekday rows.
 *
 * Uses replace-all semantics inside a transaction (delete then recreate) so the
 * stored schedule always matches the editor exactly. Inactive days are stored
 * too (so their times persist) but never produce availability — the engine
 * filters on `isActive`. Clinic-scoped and audited.
 */
export async function updateDoctorWorkingHours(
  session: AdminSession,
  doctorId: string,
  days: WorkingDayInput[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.workingHour.deleteMany({
      where: { clinicId: session.clinicId, doctorId },
    });

    await tx.workingHour.createMany({
      data: days.map((day) => ({
        clinicId: session.clinicId,
        doctorId,
        dayOfWeek: day.dayOfWeek,
        startTime: day.startTime,
        endTime: day.endTime,
        isActive: day.isActive,
      })),
    });

    await logAuditEvent(
      {
        clinicId: session.clinicId,
        actorType: "doctor",
        actorUserId: session.adminUserId,
        action: "working_hours.updated",
        entityType: "doctor",
        entityId: doctorId,
        metadata: { activeDays: days.filter((day) => day.isActive).length },
      },
      tx,
    );
  });
}
