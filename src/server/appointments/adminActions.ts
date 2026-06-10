"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/db/prisma";
import { redirect } from "@/i18n/navigation";
import {
  manualAppointmentSchema,
  type ManualAppointmentFieldErrors,
  type ManualAppointmentFormState,
} from "@/lib/validation/manualAppointmentSchema";
import {
  rescheduleAppointmentSchema,
  type RescheduleFieldErrors,
  type RescheduleFormState,
} from "@/lib/validation/rescheduleAppointmentSchema";
import { type AuditAction, logAuditEvent } from "@/server/audit/logAuditEvent";
import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/getAdminSession";
import { sendAppointmentRescheduledEmail } from "@/server/email/sendAppointmentRescheduledEmail";
import { sendBookingConfirmation } from "@/server/email/sendBookingConfirmation";
import { sendCancellationEmail } from "@/server/email/sendCancellationEmail";

import { cancelAppointmentByDoctor } from "./cancelAppointmentByDoctor";
import { createManualAppointment } from "./createManualAppointment";
import { BookingNotConfiguredError, SlotUnavailableError } from "./errors";
import { rescheduleAppointment } from "./rescheduleAppointment";

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

type StatusTransition = {
  to: "completed" | "no_show";
  action: AuditAction;
  stamp: "completedAt" | null;
};

/**
 * Apply a clinic-scoped status transition from `booked` and audit it.
 *
 * The `updateMany` is guarded by clinicId and the current `booked` status, so a
 * transition only happens for an appointment in the admin's clinic that is
 * still active. The audit row is written in the same transaction.
 */
async function applyStatusTransition(
  session: AdminSession,
  appointmentId: string,
  transition: StatusTransition,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const data: {
      status: StatusTransition["to"];
      completedAt?: Date;
    } = { status: transition.to };
    if (transition.stamp === "completedAt") {
      data.completedAt = new Date();
    }

    const updated = await tx.appointment.updateMany({
      where: {
        id: appointmentId,
        clinicId: session.clinicId,
        status: "booked",
      },
      data,
    });

    if (updated.count === 0) {
      return;
    }

    await logAuditEvent(
      {
        clinicId: session.clinicId,
        actorType: "doctor",
        actorUserId: session.adminUserId,
        action: transition.action,
        entityType: "appointment",
        entityId: appointmentId,
        metadata: { source: "admin" },
      },
      tx,
    );
  });
}

function revalidateAdmin(locale: LocaleValue, appointmentId: string): void {
  revalidatePath(`/${locale}/admin/calendar`);
  revalidatePath(`/${locale}/admin/appointments/${appointmentId}`);
}

/** Mark a booked appointment as completed. */
export async function markCompletedAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get("locale"));
  const id = String(formData.get("id") ?? "");
  const session = await requireSessionOrRedirect(locale);
  if (!id) {
    return;
  }
  await applyStatusTransition(session, id, {
    to: "completed",
    action: "appointment.completed",
    stamp: "completedAt",
  });
  revalidateAdmin(locale, id);
}

/** Mark a booked appointment as a no-show. */
export async function markNoShowAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get("locale"));
  const id = String(formData.get("id") ?? "");
  const session = await requireSessionOrRedirect(locale);
  if (!id) {
    return;
  }
  await applyStatusTransition(session, id, {
    to: "no_show",
    action: "appointment.no_show",
    stamp: null,
  });
  revalidateAdmin(locale, id);
}

/**
 * Cancel a booked appointment as the doctor/clinic (frees the slot) and notify
 * the patient with the same cancellation email used for self-service cancels.
 *
 * The email is best-effort and only attempted when the patient has an email on
 * file (manual entries may not), so a missing address or transient mail error
 * never affects the already-committed cancellation.
 */
export async function cancelByDoctorAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get("locale"));
  const id = String(formData.get("id") ?? "");
  const session = await requireSessionOrRedirect(locale);
  if (!id) {
    return;
  }

  const result = await cancelAppointmentByDoctor(session, id);
  if (result && result.to) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await sendCancellationEmail({
      to: result.to,
      locale,
      doctorName: result.doctorName,
      clinicName: result.clinicName,
      startsAt: result.startsAt,
      timeZone: result.timeZone,
      rebookUrl: `${appUrl}/${locale}/booking`,
    });
  }

  revalidateAdmin(locale, id);
}

/**
 * Create a manual appointment from the admin form.
 *
 * Validates with Zod (translatable codes), enforces an authenticated admin
 * session, then delegates to createManualAppointment (same overlap protection
 * as public booking). On success, redirects to the new appointment's detail.
 */
export async function createManualAppointmentAction(
  _previousState: ManualAppointmentFormState,
  formData: FormData,
): Promise<ManualAppointmentFormState> {
  const rawEmail = formData.get("email");
  const rawMessage = formData.get("message");
  const parsed = manualAppointmentSchema.safeParse({
    locale: String(formData.get("locale") ?? ""),
    date: String(formData.get("date") ?? ""),
    time: String(formData.get("time") ?? ""),
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email:
      typeof rawEmail === "string" && rawEmail.trim().length > 0
        ? rawEmail.trim()
        : undefined,
    message:
      typeof rawMessage === "string" && rawMessage.trim().length > 0
        ? rawMessage
        : undefined,
    notifyPatient: formData.get("notify") === "on",
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const fieldErrors: ManualAppointmentFieldErrors = {};
    for (const [key, codes] of Object.entries(flattened)) {
      if (codes && codes.length > 0) {
        fieldErrors[key as keyof ManualAppointmentFieldErrors] = codes[0];
      }
    }
    return { fieldErrors, formError: null };
  }

  const locale = parsed.data.locale;
  const session = await requireSessionOrRedirect(locale);

  let result;
  try {
    result = await createManualAppointment(session, parsed.data);
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      return { fieldErrors: {}, formError: "slotUnavailable" };
    }
    if (error instanceof BookingNotConfiguredError) {
      return { fieldErrors: {}, formError: "notConfigured" };
    }
    console.error("[admin] unexpected error creating manual appointment");
    return { fieldErrors: {}, formError: "unexpected" };
  }

  // Best-effort patient confirmation (with a self-cancel link) when requested
  // and an email is on file; never blocks the committed appointment.
  if (result.notification) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const notification = result.notification;
    await sendBookingConfirmation({
      to: notification.to,
      locale: notification.locale,
      doctorName: notification.doctorName,
      clinicName: notification.clinicName,
      startsAt: notification.startsAt,
      timeZone: notification.timeZone,
      cancelUrl: `${appUrl}/${notification.locale}/cancel/${notification.cancellationToken}`,
    });
  }

  revalidateAdmin(locale, result.id);
  return redirect({ href: `/admin/appointments/${result.id}`, locale });
}

/**
 * Reschedule a booked appointment to a new date/time from the admin form.
 *
 * Validates with Zod (translatable codes), enforces an authenticated admin
 * session, then delegates to rescheduleAppointment (same overlap protection as
 * booking). On success, best-effort emails the patient the new time with a
 * self-cancel link (only when an email is on file) and redirects back to the
 * appointment detail.
 */
export async function rescheduleAction(
  _previousState: RescheduleFormState,
  formData: FormData,
): Promise<RescheduleFormState> {
  const parsed = rescheduleAppointmentSchema.safeParse({
    locale: String(formData.get("locale") ?? ""),
    id: String(formData.get("id") ?? ""),
    date: String(formData.get("date") ?? ""),
    time: String(formData.get("time") ?? ""),
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const fieldErrors: RescheduleFieldErrors = {};
    for (const [key, codes] of Object.entries(flattened)) {
      if (codes && codes.length > 0) {
        fieldErrors[key as keyof RescheduleFieldErrors] = codes[0];
      }
    }
    return { fieldErrors, formError: null };
  }

  const locale = parsed.data.locale;
  const session = await requireSessionOrRedirect(locale);

  let result;
  try {
    result = await rescheduleAppointment(session, parsed.data);
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      return { fieldErrors: {}, formError: "slotUnavailable" };
    }
    if (error instanceof BookingNotConfiguredError) {
      return { fieldErrors: {}, formError: "notConfigured" };
    }
    console.error("[admin] unexpected error rescheduling appointment");
    return { fieldErrors: {}, formError: "unexpected" };
  }

  if (!result) {
    return { fieldErrors: {}, formError: "unexpected" };
  }

  // Best-effort patient notification (with a self-cancel link) when an email is
  // on file; never blocks the committed reschedule.
  if (result.notification) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const notification = result.notification;
    await sendAppointmentRescheduledEmail({
      to: notification.to,
      locale: notification.locale,
      doctorName: notification.doctorName,
      clinicName: notification.clinicName,
      oldStartsAt: notification.oldStartsAt,
      newStartsAt: notification.newStartsAt,
      timeZone: notification.timeZone,
      cancelUrl: `${appUrl}/${notification.locale}/cancel/${notification.cancellationToken}`,
    });
  }

  revalidateAdmin(locale, result.id);
  return redirect({ href: `/admin/appointments/${result.id}`, locale });
}
