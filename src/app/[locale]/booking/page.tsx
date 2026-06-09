import { getTranslations, setRequestLocale } from "next-intl/server";

import { BookingPanel } from "@/components/booking/booking-panel";
import { DateSelector } from "@/components/booking/date-selector";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Link } from "@/i18n/navigation";
import { getAvailability } from "@/server/appointments/getAvailability";
import { getBookingContext } from "@/server/appointments/getBookingContext";

// Availability is live data and the page reads request-time search params, so
// it must be rendered per request rather than statically prerendered.
export const dynamic = "force-dynamic";

type BookingPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string }>;
};

export default async function BookingPage({
  params,
  searchParams,
}: BookingPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("booking");
  const context = await getBookingContext();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          {context ? (
            <p className="text-muted-foreground text-sm">
              {t("subtitle", {
                doctor: context.doctorName,
                clinic: context.clinicName,
              })}
            </p>
          ) : null}
        </div>
        <LocaleSwitcher />
      </header>

      {!context ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
          {t("notConfigured")}
        </p>
      ) : (
        <BookingContent
          clinicId={context.clinicId}
          doctorId={context.doctorId}
          timeZone={context.timeZone}
          locale={locale}
          requestedDate={(await searchParams).date}
          labels={{ selectDate: t("selectDate"), noSlots: t("noSlotsWindow") }}
        />
      )}

      <footer>
        <Link href="/" className="text-sm underline-offset-4 hover:underline">
          {t("backHome")}
        </Link>
      </footer>
    </main>
  );
}

type BookingContentProps = {
  clinicId: string;
  doctorId: string;
  timeZone: string;
  locale: string;
  requestedDate?: string;
  labels: { selectDate: string; noSlots: string };
};

async function BookingContent({
  clinicId,
  doctorId,
  timeZone,
  locale,
  requestedDate,
  labels,
}: BookingContentProps) {
  const availability = await getAvailability({ clinicId, doctorId, timeZone });
  const availableDays = availability.filter((day) => day.slots.length > 0);

  if (availableDays.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
        {labels.noSlots}
      </p>
    );
  }

  const dayKeys = availableDays.map((day) => day.date);
  const selectedDate =
    requestedDate && dayKeys.includes(requestedDate)
      ? requestedDate
      : dayKeys[0];
  const selectedDay =
    availableDays.find((day) => day.date === selectedDate) ?? availableDays[0];

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{labels.selectDate}</h2>
        <DateSelector
          days={dayKeys}
          selectedDate={selectedDate}
          locale={locale}
          timeZone={timeZone}
        />
      </section>

      <BookingPanel
        key={selectedDate}
        slots={selectedDay.slots}
        locale={locale}
        timeZone={timeZone}
      />
    </div>
  );
}
