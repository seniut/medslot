"use server";

import { headers } from "next/headers";

import { redirect } from "@/i18n/navigation";
import {
  bookingSchema,
  type BookingFieldErrors,
  type BookingFormState,
} from "@/lib/validation/bookingSchema";
import { sendBookingConfirmation } from "@/server/email/sendBookingConfirmation";
import {
  resolveDoctorNotificationRecipient,
  sendDoctorNewBookingEmail,
} from "@/server/email/sendDoctorNewBookingEmail";

import { createAppointment } from "./createAppointment";
import { BookingNotConfiguredError, SlotUnavailableError } from "./errors";

/**
 * Server action backing the public booking form.
 *
 * Validates input with Zod, creates the appointment (which re-checks
 * availability and relies on the DB no-overlap constraint), sends a localized
 * confirmation email, then redirects to the confirmation page. Returns a
 * typed state with translatable error codes on failure.
 */
export async function createBookingAction(
  _previousState: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const rawMessage = formData.get("message");
  const raw = {
    locale: String(formData.get("locale") ?? ""),
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    message:
      typeof rawMessage === "string" && rawMessage.trim().length > 0
        ? rawMessage
        : undefined,
    consent: formData.get("consent") === "true",
  };

  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const fieldErrors: BookingFieldErrors = {};
    for (const [key, codes] of Object.entries(flattened)) {
      if (codes && codes.length > 0) {
        fieldErrors[key as keyof BookingFieldErrors] = codes[0];
      }
    }
    return { fieldErrors, formError: null };
  }

  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  const ipAddress = forwardedFor
    ? (forwardedFor.split(",")[0]?.trim() ?? null)
    : null;
  const userAgent = headerList.get("user-agent");

  let result;
  try {
    result = await createAppointment(parsed.data, { ipAddress, userAgent });
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      return { fieldErrors: {}, formError: "slotUnavailable" };
    }
    if (error instanceof BookingNotConfiguredError) {
      return { fieldErrors: {}, formError: "bookingNotConfigured" };
    }
    console.error("[booking] unexpected error creating appointment");
    return { fieldErrors: {}, formError: "unexpected" };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cancelUrl = `${appUrl}/${parsed.data.locale}/cancel/${result.cancellationToken}`;

  await sendBookingConfirmation({
    to: parsed.data.email,
    locale: parsed.data.locale,
    doctorName: result.doctorName,
    clinicName: result.clinicName,
    startsAt: result.startsAt,
    timeZone: result.timeZone,
    cancelUrl,
  });

  // Notify the doctor/clinic of the new booking on the clinic's own locale
  // (not the patient's). Best-effort and only when a recipient is configured.
  const doctorRecipient = resolveDoctorNotificationRecipient(
    result.doctorEmail,
  );
  if (doctorRecipient) {
    const notifyLocale = result.defaultLocale === "en" ? "en" : "pl";
    await sendDoctorNewBookingEmail({
      to: doctorRecipient,
      locale: notifyLocale,
      clinicName: result.clinicName,
      patientName: `${parsed.data.firstName} ${parsed.data.lastName}`,
      patientPhone: parsed.data.phone,
      patientEmail: parsed.data.email,
      patientMessage: parsed.data.message ?? null,
      startsAt: result.startsAt,
      timeZone: result.timeZone,
      adminUrl: `${appUrl}/${notifyLocale}/admin/appointments/${result.id}`,
    });
  }

  // `redirect` throws (its return type is `never`); returning it makes the
  // control flow explicit and satisfies the function's return type.
  return redirect({
    href: { pathname: "/booking/confirmation", query: { id: result.id } },
    locale: parsed.data.locale,
  });
}
