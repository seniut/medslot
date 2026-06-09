import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { formatInTimeZone } from "@/lib/date-time/timezone";

import { getEmailAdapter } from "./adapter";

export type BookingConfirmationParams = {
  to: string;
  locale: Locale;
  doctorName: string;
  clinicName: string;
  startsAt: Date;
  timeZone: string;
  /** Absolute cancellation URL containing the one-time token. */
  cancelUrl: string;
};

/**
 * Send a localized booking confirmation email.
 *
 * Best-effort: failures are swallowed (and logged without PII) so a transient
 * email error never rolls back a successful booking. The token-bearing
 * cancelUrl is passed to the adapter but never logged here.
 */
export async function sendBookingConfirmation(
  params: BookingConfirmationParams,
): Promise<void> {
  try {
    const t = await getTranslations({
      locale: params.locale,
      namespace: "emails.bookingConfirmation",
    });

    const when = formatInTimeZone(params.startsAt, params.locale, params.timeZone, {
      dateStyle: "long",
      timeStyle: "short",
    });

    const subject = t("subject", { clinic: params.clinicName });
    const lines = [
      t("greeting"),
      "",
      t("body", { doctor: params.doctorName, datetime: when }),
      "",
      t("cancelIntro"),
      params.cancelUrl,
      "",
      t("signature", { clinic: params.clinicName }),
    ];
    const text = lines.join("\n");
    const html = lines
      .map((line) =>
        line === ""
          ? "<br/>"
          : `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`,
      )
      .join("");

    await getEmailAdapter().send({ to: params.to, subject, text, html });
  } catch {
    // Never expose recipient/token; log a safe, generic message only.
    console.error("[email] booking confirmation failed to send");
  }
}
