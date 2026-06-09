"use server";

import { prisma } from "@/db/prisma";
import { redirect } from "@/i18n/navigation";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import {
  loginSchema,
  type LoginFormState,
} from "@/lib/validation/adminAuthSchema";

import { clearAdminSessionCookie, setAdminSessionCookie } from "./session";

// Cached dummy hash so a missing user still performs a scrypt verification,
// keeping login timing roughly constant and avoiding user enumeration.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword("medslot-nonexistent-user");
  return dummyHashPromise;
}

/**
 * Authenticate an admin user and start a session.
 *
 * Validation, lookup, and password verification all collapse to a single
 * generic error so the form never reveals whether an email is registered.
 * On success, issues a signed session cookie and redirects to the calendar.
 */
export async function loginAction(
  _previousState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse({
    locale: String(formData.get("locale") ?? ""),
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: "invalidCredentials" };
  }

  const user = await prisma.adminUser.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true },
  });

  const hashToCheck = user?.passwordHash ?? (await getDummyHash());
  const passwordOk = await verifyPassword(parsed.data.password, hashToCheck);

  if (!user || !passwordOk) {
    return { error: "invalidCredentials" };
  }

  await setAdminSessionCookie(user.id);

  // `redirect` throws; returning it satisfies the typed control flow.
  return redirect({ href: "/admin/calendar", locale: parsed.data.locale });
}

/** End the current admin session and return to the login page. */
export async function logoutAction(formData: FormData): Promise<void> {
  const localeValue = String(formData.get("locale") ?? "pl");
  const locale = localeValue === "en" ? "en" : "pl";
  await clearAdminSessionCookie();
  return redirect({ href: "/admin/login", locale });
}
