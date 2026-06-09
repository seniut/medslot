import { getTranslations, setRequestLocale } from "next-intl/server";

import { CancelConfirm } from "@/components/booking/cancel-confirm";
import { Link } from "@/i18n/navigation";
import { formatInTimeZone } from "@/lib/date-time/timezone";
import { getAppointmentByCancelToken } from "@/server/appointments/getCancellation";

// Resolves an appointment from a request-time token; never prerender.
export const dynamic = "force-dynamic";

type CancelPageProps = {
  params: Promise<{ locale: string; token: string }>;
};

export default async function CancelPage({ params }: CancelPageProps) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("cancel");
  const view = await getAppointmentByCancelToken(token);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      {renderBody()}
      <div>
        <Link href="/" className="text-sm underline-offset-4 hover:underline">
          {t("backHome")}
        </Link>
      </div>
    </main>
  );

  function renderBody() {
    if (!view) {
      return (
        <Message title={t("invalidTitle")} message={t("invalidMessage")} />
      );
    }

    const when = t("when", {
      datetime: formatInTimeZone(view.startsAt, locale, view.timeZone, {
        dateStyle: "long",
        timeStyle: "short",
      }),
    });
    const isCancelled =
      view.status === "cancelled_by_patient" ||
      view.status === "cancelled_by_doctor";
    const isConcluded =
      view.status === "completed" || view.status === "no_show";
    const isPast = view.startsAt.getTime() <= Date.now();

    if (isCancelled) {
      return (
        <Message
          title={t("alreadyCancelledTitle")}
          message={t("alreadyCancelledMessage")}
          when={when}
          rebookLabel={t("rebook")}
        />
      );
    }
    if (isConcluded || isPast) {
      return (
        <Message
          title={t("cannotCancelTitle")}
          message={t("cannotCancelMessage")}
          when={when}
        />
      );
    }

    return (
      <div className="space-y-4">
        <p className="rounded-md border p-4 text-sm font-medium">{when}</p>
        <CancelConfirm token={token} locale={locale} />
      </div>
    );
  }
}

type MessageProps = {
  title: string;
  message: string;
  when?: string;
  rebookLabel?: string;
};

function Message({ title, message, when, rebookLabel }: MessageProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {when ? (
        <p className="rounded-md border p-4 text-sm font-medium">{when}</p>
      ) : null}
      <p className="text-muted-foreground text-sm">{message}</p>
      {rebookLabel ? (
        <Link
          href="/booking"
          className="text-sm underline-offset-4 hover:underline"
        >
          {rebookLabel}
        </Link>
      ) : null}
    </div>
  );
}
