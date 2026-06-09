import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { prisma } from "@/db/prisma";
import { formatInTimeZone } from "@/lib/date-time/timezone";
import { getBookingContext } from "@/server/appointments/getBookingContext";

// Reads a specific appointment by id at request time; never prerender.
export const dynamic = "force-dynamic";

type ConfirmationPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ id?: string }>;
};

export default async function BookingConfirmationPage({
  params,
  searchParams,
}: ConfirmationPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("booking.confirmation");
  const { id } = await searchParams;
  const context = await getBookingContext();

  let formattedWhen: string | null = null;
  if (id && context) {
    // Select no patient fields — confirmation must stay PII-free.
    const appointment = await prisma.appointment.findFirst({
      where: { id, clinicId: context.clinicId },
      select: { startsAt: true },
    });
    if (appointment) {
      formattedWhen = formatInTimeZone(
        appointment.startsAt,
        locale,
        context.timeZone,
        { dateStyle: "long", timeStyle: "short" },
      );
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">{t("message")}</p>
      {formattedWhen ? (
        <p className="rounded-md border p-4 text-sm font-medium">
          {t("when", { datetime: formattedWhen })}
        </p>
      ) : null}
      <p className="text-muted-foreground text-sm">{t("emailNote")}</p>
      <div>
        <Link href="/" className="text-sm underline-offset-4 hover:underline">
          {t("backHome")}
        </Link>
      </div>
    </main>
  );
}
