import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { formatInTimeZone } from "@/lib/date-time/timezone";

import { getEmailAdapter } from "./adapter";
import { renderBrandedEmailHtml } from "./emailLayout";

export type DoctorNewBookingEmailParams = {
  /** Recipient (resolved doctor notification address). */
  to: string;
  /** Clinic-facing locale (clinic default), not the patient's locale. */
  locale: Locale;
  clinicName: string;
  patientName: string;
  patientPhone: string;
  /** Patient email, or empty when not provided. */
  patientEmail: string;
  /** Optional patient message; omitted from the email when empty. */
  patientMessage: string | null;
  startsAt: Date;
  timeZone: string;
  /** Absolute URL to the admin appointment detail page. */
  adminUrl: string;
};

/**
 * Resolve who receives the new-booking notification.
 *
 * `DOCTOR_NOTIFICATION_EMAIL` is an explicit override (e.g. a shared front-desk
 * inbox); otherwise the doctor's own email is used. Returns null when neither is
 * a non-empty address, so the caller can skip sending.
 */
export function resolveDoctorNotificationRecipient(
  doctorEmail: string,
  overrideEnv = process.env.DOCTOR_NOTIFICATION_EMAIL,
): string | null {
  const override = overrideEnv?.trim();
  if (override) {
    return override;
  }
  const doctor = doctorEmail.trim();
  return doctor.length > 0 ? doctor : null;
}

/**
 * Notify the doctor/clinic that a new appointment was booked from the public
 * page. The recipient is clinic staff (the data controller), so the email may
 * include the patient's contact details needed to act on the booking.
 *
 * Best-effort: failures are swallowed (and logged without PII) so a transient
 * email error never affects the already-committed booking.
 */
export async function sendDoctorNewBookingEmail(
  params: DoctorNewBookingEmailParams,
): Promise<void> {
  try {
    const t = await getTranslations({
      locale: params.locale,
      namespace: "emails.doctorNewBooking",
    });

    const when = formatInTimeZone(
      params.startsAt,
      params.locale,
      params.timeZone,
      { dateStyle: "long", timeStyle: "short" },
    );

    const subject = t("subject", { clinic: params.clinicName });
    const lines = [
      t("greeting"),
      "",
      t("body"),
      "",
      `${t("labelWhen")}: ${when}`,
      `${t("labelPatient")}: ${params.patientName}`,
      `${t("labelPhone")}: ${params.patientPhone}`,
    ];
    if (params.patientEmail.trim().length > 0) {
      lines.push(`${t("labelEmail")}: ${params.patientEmail}`);
    }
    if (params.patientMessage && params.patientMessage.trim().length > 0) {
      lines.push(`${t("labelMessage")}: ${params.patientMessage}`);
    }
    lines.push(
      "",
      t("linkIntro"),
      params.adminUrl,
      "",
      t("signature", {
        clinic: params.clinicName,
      }),
    );

    const text = lines.join("\n");
    const html = renderBrandedEmailHtml(lines);

    await getEmailAdapter().send({ to: params.to, subject, text, html });
  } catch {
    // Never expose recipient/patient details; log a safe, generic message only.
    console.error("[email] doctor new-booking notice failed to send");
  }
}
