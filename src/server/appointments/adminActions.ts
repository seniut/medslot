"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/db/prisma";
import { redirect } from "@/i18n/navigation";
import {
  manualAppointmentSchema,
  type ManualAppointmentFieldErrors,
  type ManualAppointmentFormState,
} from "@/lib/validation/manualAppointmentSchema";
import { type AuditAction, logAuditEvent } from "@/server/audit/logAuditEvent";
import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/getAdminSession";

import { createManualAppointment } from "./createManualAppointment";
import { BookingNotConfiguredError, SlotUnavailableError } from "./errors";

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
  to: "completed" | "no_show" | "cancelled_by_doctor";
  action: AuditAction;
  stamp: "completedAt" | "cancelledAt" | null;
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
      cancelledAt?: Date;
    } = { status: transition.to };
    if (transition.stamp === "completedAt") {
      data.completedAt = new Date();
    } else if (transition.stamp === "cancelledAt") {
      data.cancelledAt = new Date();
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

/** Cancel a booked appointment as the doctor/clinic (frees the slot). */
export async function cancelByDoctorAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get("locale"));
  const id = String(formData.get("id") ?? "");
  const session = await requireSessionOrRedirect(locale);
  if (!id) {
    return;
  }
  await applyStatusTransition(session, id, {
    to: "cancelled_by_doctor",
    action: "appointment.cancelled_by_doctor",
    stamp: "cancelledAt",
  });
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

  revalidateAdmin(locale, result.id);
  return redirect({ href: `/admin/appointments/${result.id}`, locale });
}
