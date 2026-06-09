"use server";

import {
  cancellationSchema,
  type CancelFormState,
} from "@/lib/validation/cancellationSchema";
import { sendCancellationEmail } from "@/server/email/sendCancellationEmail";

import { cancelAppointmentByToken } from "./cancelAppointment";
import {
  AppointmentNotCancellableError,
  AppointmentNotFoundError,
} from "./errors";

/**
 * Server action backing the cancellation confirm button.
 *
 * Validates the token/locale, cancels the appointment (status →
 * `cancelled_by_patient`, which frees the slot), then sends a localized
 * cancellation email. Returns a typed state with translatable error codes.
 */
export async function cancelAppointmentAction(
  _previousState: CancelFormState,
  formData: FormData,
): Promise<CancelFormState> {
  const parsed = cancellationSchema.safeParse({
    locale: String(formData.get("locale") ?? ""),
    token: String(formData.get("token") ?? ""),
  });
  if (!parsed.success) {
    return { status: "error", errorCode: "notFound" };
  }

  let result;
  try {
    result = await cancelAppointmentByToken(parsed.data.token);
  } catch (error) {
    if (error instanceof AppointmentNotFoundError) {
      return { status: "error", errorCode: "notFound" };
    }
    if (error instanceof AppointmentNotCancellableError) {
      return { status: "error", errorCode: "notCancellable" };
    }
    console.error("[cancel] unexpected error cancelling appointment");
    return { status: "error", errorCode: "unexpected" };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const rebookUrl = `${appUrl}/${parsed.data.locale}/booking`;

  await sendCancellationEmail({
    to: result.to,
    locale: parsed.data.locale,
    doctorName: result.doctorName,
    clinicName: result.clinicName,
    startsAt: result.startsAt,
    timeZone: result.timeZone,
    rebookUrl,
  });

  return { status: "success", errorCode: null };
}
