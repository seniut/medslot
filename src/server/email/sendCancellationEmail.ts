import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { formatInTimeZone } from "@/lib/date-time/timezone";

import { getEmailAdapter } from "./adapter";
import { renderBrandedEmailHtml } from "./emailLayout";

export type CancellationEmailParams = {
  to: string;
  locale: Locale;
  doctorName: string;
  clinicName: string;
  startsAt: Date;
  timeZone: string;
  /** Absolute URL back to the booking page so the patient can rebook. */
  rebookUrl: string;
};

/**
 * Send a localized appointment-cancellation email.
 *
 * Best-effort: failures are swallowed (and logged without PII) so a transient
 * email error never affects the already-committed cancellation.
 */
export async function sendCancellationEmail(
  params: CancellationEmailParams,
): Promise<void> {
  try {
    const t = await getTranslations({
      locale: params.locale,
      namespace: "emails.cancellationConfirmation",
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
      t("body", { doctor: params.doctorName, datetime: when }),
      "",
      t("rebookIntro"),
      params.rebookUrl,
      "",
      t("signature", { clinic: params.clinicName }),
    ];
    const text = lines.join("\n");
    const html = renderBrandedEmailHtml(lines);

    await getEmailAdapter().send({ to: params.to, subject, text, html });
  } catch {
    // Never expose recipient/details; log a safe, generic message only.
    console.error("[email] cancellation notice failed to send");
  }
}
