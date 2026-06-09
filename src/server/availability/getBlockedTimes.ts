import { prisma } from "@/db/prisma";

export type BlockedTimeItem = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
};

/**
 * List the doctor's upcoming blocked-time intervals (those not yet ended),
 * earliest first. Clinic-scoped.
 */
export async function getUpcomingBlockedTimes({
  clinicId,
  doctorId,
  now = new Date(),
}: {
  clinicId: string;
  doctorId: string;
  now?: Date;
}): Promise<BlockedTimeItem[]> {
  return prisma.blockedTime.findMany({
    where: { clinicId, doctorId, endsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
    take: 100,
    select: { id: true, startsAt: true, endsAt: true, reason: true },
  });
}
