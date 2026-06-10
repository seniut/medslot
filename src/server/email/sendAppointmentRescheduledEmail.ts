import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { formatInTimeZone } from "@/lib/date-time/timezone";

import { getEmailAdapter } from "./adapter";
import { renderBrandedEmailHtml } from "./emailLayout";

export type AppointmentRescheduledEmailParams = {
  to: string;
  locale: Locale;
  doctorName: string;
  clinicName: string;
  oldStartsAt: Date;
  newStartsAt: Date;
  timeZone: string;
  /** Absolute cancellation URL containing the one-time token. */
  cancelUrl: string;
};

/**
 * Send a localized "appointment rescheduled" email showing the previous and new
 * date/time plus a self-cancellation link.
 *
 * Best-effort: failures are swallowed (and logged without PII) so a transient
 * email error never affects the already-committed reschedule. The token-bearing
 * cancelUrl is passed to the adapter but never logged here.
 */
export async function sendAppointmentRescheduledEmail(
  params: AppointmentRescheduledEmailParams,
): Promise<void> {
  try {
    const t = await getTranslations({
      locale: params.locale,
      namespace: "emails.appointmentRescheduled",
    });

    const formatOptions: Intl.DateTimeFormatOptions = {
      dateStyle: "long",
      timeStyle: "short",
    };
    const oldWhen = formatInTimeZone(
      params.oldStartsAt,
      params.locale,
      params.timeZone,
      formatOptions,
    );
    const newWhen = formatInTimeZone(
      params.newStartsAt,
      params.locale,
      params.timeZone,
      formatOptions,
    );

    const subject = t("subject", { clinic: params.clinicName });
    const lines = [
      t("greeting"),
      "",
      t("body", { doctor: params.doctorName }),
      "",
      `${t("labelPrevious")}: ${oldWhen}`,
      `${t("labelNew")}: ${newWhen}`,
      "",
      t("cancelIntro"),
      params.cancelUrl,
      "",
      t("signature", { clinic: params.clinicName }),
    ];
    const text = lines.join("\n");
    const html = renderBrandedEmailHtml(lines);

    await getEmailAdapter().send({ to: params.to, subject, text, html });
  } catch {
    // Never expose recipient/token; log a safe, generic message only.
    console.error("[email] reschedule notice failed to send");
  }
}
