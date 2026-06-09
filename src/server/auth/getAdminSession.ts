import { prisma } from "@/db/prisma";

import { readAdminUserIdFromCookie } from "./session";

export type AdminSession = {
  adminUserId: string;
  clinicId: string;
  doctorId: string | null;
  role: string;
  email: string;
};

/**
 * Resolve the current admin session.
 *
 * Verifies the signed session cookie, then re-loads the admin user from the
 * database so authorization data (clinic scope, role) always reflects the
 * current state and is never trusted from the cookie. Returns null when there
 * is no valid session.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const adminUserId = await readAdminUserIdFromCookie();
  if (!adminUserId) {
    return null;
  }

  const user = await prisma.adminUser.findUnique({
    where: { id: adminUserId },
    select: {
      id: true,
      clinicId: true,
      doctorId: true,
      role: true,
      email: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    adminUserId: user.id,
    clinicId: user.clinicId,
    doctorId: user.doctorId,
    role: user.role,
    email: user.email,
  };
}
