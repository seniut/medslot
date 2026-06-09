import { prisma } from "@/db/prisma";
import { logAuditEvent } from "@/server/audit/logAuditEvent";
import type { AdminSession } from "@/server/auth/getAdminSession";

/**
 * Delete a blocked-time interval by id, scoped to the admin's clinic so a
 * tampered id cannot remove another clinic's data. Audited only when a row was
 * actually removed.
 */
export async function deleteDoctorBlockedTime(
  session: AdminSession,
  id: string,
): Promise<void> {
  const result = await prisma.blockedTime.deleteMany({
    where: { id, clinicId: session.clinicId },
  });

  if (result.count > 0) {
    await logAuditEvent({
      clinicId: session.clinicId,
      actorType: "doctor",
      actorUserId: session.adminUserId,
      action: "blocked_time.deleted",
      entityType: "blocked_time",
      entityId: id,
    });
  }
}
