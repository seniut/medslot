import { redirect } from "@/i18n/navigation";

import { getAdminSession, type AdminSession } from "./getAdminSession";

/**
 * Require an authenticated admin session for a server component / page.
 *
 * Redirects to the localized admin login page when there is no valid session.
 * `redirect` throws (its return type is `never`), so the returned value is
 * always a valid session.
 */
export async function requireAdmin(locale: string): Promise<AdminSession> {
  const session = await getAdminSession();
  if (session) {
    return session;
  }
  return redirect({ href: "/admin/login", locale });
}
