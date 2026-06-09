"use server";

import { revalidatePath } from "next/cache";

import { redirect } from "@/i18n/navigation";
import {
  blockedTimeSchema,
  type BlockedTimeFieldErrors,
  type BlockedTimeFormState,
} from "@/lib/validation/blockedTimeSchema";
import {
  WEEKDAYS,
  validateWorkingDays,
  type WorkingDayInput,
  type WorkingHoursFormState,
} from "@/lib/validation/workingHoursSchema";
import { getBookingContext } from "@/server/appointments/getBookingContext";
import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/getAdminSession";

import { createDoctorBlockedTime } from "./createBlockedTime";
import { deleteDoctorBlockedTime } from "./deleteBlockedTime";
import { updateDoctorWorkingHours } from "./updateWorkingHours";

type LocaleValue = "pl" | "en";

function toLocale(value: FormDataEntryValue | null): LocaleValue {
  return value === "en" ? "en" : "pl";
}

async function requireSessionOrRedirect(
  locale: LocaleValue,
): Promise<AdminSession> {
  const session = await getAdminSession();
  if (session) {
    return session;
  }
  return redirect({ href: "/admin/login", locale });
}

/**
 * Resolve the bookable doctor for this admin's clinic.
 *
 * Availability settings edit the same doctor whose slots are shown publicly, so
 * we use the booking context but require it to belong to the admin's clinic.
 */
async function resolveDoctor(
  session: AdminSession,
): Promise<{ doctorId: string; timeZone: string } | null> {
  const context = await getBookingContext();
  if (!context || context.clinicId !== session.clinicId) {
    return null;
  }
  return { doctorId: context.doctorId, timeZone: context.timeZone };
}

// Working hours and blocked time both change patient-facing availability, so
// revalidate the public booking page alongside the settings page.
function revalidateAvailability(locale: LocaleValue): void {
  revalidatePath(`/${locale}/admin/settings`);
  revalidatePath(`/${locale}/booking`);
}

/** Replace the doctor's weekly working hours from the settings form. */
export async function updateWorkingHoursAction(
  _previousState: WorkingHoursFormState,
  formData: FormData,
): Promise<WorkingHoursFormState> {
  const locale = toLocale(formData.get("locale"));
  const session = await requireSessionOrRedirect(locale);

  const days: WorkingDayInput[] = WEEKDAYS.map((dayOfWeek) => ({
    dayOfWeek,
    isActive: formData.get(`active-${dayOfWeek}`) === "on",
    startTime: String(formData.get(`start-${dayOfWeek}`) ?? ""),
    endTime: String(formData.get(`end-${dayOfWeek}`) ?? ""),
  }));

  const fieldErrors = validateWorkingDays(days);
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, formError: null, saved: false };
  }

  const doctor = await resolveDoctor(session);
  if (!doctor) {
    return { fieldErrors: {}, formError: "notConfigured", saved: false };
  }

  try {
    await updateDoctorWorkingHours(session, doctor.doctorId, days);
  } catch {
    console.error("[admin] failed to update working hours");
    return { fieldErrors: {}, formError: "unexpected", saved: false };
  }

  revalidateAvailability(locale);
  return { fieldErrors: {}, formError: null, saved: true };
}

/** Create a blocked-time interval from the settings form. */
export async function createBlockedTimeAction(
  _previousState: BlockedTimeFormState,
  formData: FormData,
): Promise<BlockedTimeFormState> {
  const rawReason = formData.get("reason");
  const parsed = blockedTimeSchema.safeParse({
    locale: String(formData.get("locale") ?? ""),
    date: String(formData.get("date") ?? ""),
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    reason:
      typeof rawReason === "string" && rawReason.trim().length > 0
        ? rawReason
        : undefined,
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const fieldErrors: BlockedTimeFieldErrors = {};
    for (const [key, codes] of Object.entries(flattened)) {
      if (codes && codes.length > 0) {
        fieldErrors[key as keyof BlockedTimeFieldErrors] = codes[0];
      }
    }
    return { fieldErrors, formError: null, saved: false };
  }

  const locale = parsed.data.locale;
  const session = await requireSessionOrRedirect(locale);

  const doctor = await resolveDoctor(session);
  if (!doctor) {
    return { fieldErrors: {}, formError: "notConfigured", saved: false };
  }

  try {
    await createDoctorBlockedTime(session, {
      doctorId: doctor.doctorId,
      timeZone: doctor.timeZone,
      input: parsed.data,
    });
  } catch {
    console.error("[admin] failed to create blocked time");
    return { fieldErrors: {}, formError: "unexpected", saved: false };
  }

  revalidateAvailability(locale);
  return { fieldErrors: {}, formError: null, saved: true };
}

/** Remove a blocked-time interval by id (clinic-scoped). */
export async function deleteBlockedTimeAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get("locale"));
  const id = String(formData.get("id") ?? "");
  const session = await requireSessionOrRedirect(locale);
  if (!id) {
    return;
  }
  await deleteDoctorBlockedTime(session, id);
  revalidateAvailability(locale);
}
