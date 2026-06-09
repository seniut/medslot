import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  enumerateZonedDates,
  formatInTimeZone,
  shiftIsoDate,
  zonedWallTimeToUtc,
} from "@/lib/date-time/timezone";
import { getAdminCalendarDay } from "@/server/appointments/getAdminCalendar";
import { getBookingContext } from "@/server/appointments/getBookingContext";
import { requireAdmin } from "@/server/auth/requireAdmin";

export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type AdminCalendarPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string }>;
};

export default async function AdminCalendarPage({
  params,
  searchParams,
}: AdminCalendarPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await requireAdmin(locale);
  const t = await getTranslations("admin");

  const context = await getBookingContext();
  const timeZone = context?.timeZone ?? "Europe/Warsaw";

  const { date: dateParam } = await searchParams;
  const today = enumerateZonedDates(timeZone, new Date(), 1)[0].dateString;
  const date =
    dateParam && ISO_DATE.test(dateParam) ? dateParam : today;

  const appointments = await getAdminCalendarDay({
    clinicId: session.clinicId,
    timeZone,
    date,
  });

  const [year, month, day] = date.split("-").map(Number);
  const dayAnchor = zonedWallTimeToUtc(timeZone, {
    year,
    month,
    day,
    hour: 12,
    minute: 0,
  });
  const heading = formatInTimeZone(dayAnchor, locale, timeZone, {
    dateStyle: "full",
  });

  const prevDate = shiftIsoDate(date, -1);
  const nextDate = shiftIsoDate(date, 1);

  return (
    <AdminShell locale={locale} email={session.email}>
      <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("calendar.title")}</h1>
        <Button asChild size="sm">
          <Link href={`/admin/appointments/new?date=${date}`}>
            {t("calendar.newAppointment")}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/admin/calendar?date=${prevDate}`}
            className="rounded-md border px-3 py-1.5 hover:bg-accent"
          >
            ‹ {t("calendar.previous")}
          </Link>
          <Link
            href="/admin/calendar"
            className="rounded-md border px-3 py-1.5 hover:bg-accent"
          >
            {t("calendar.today")}
          </Link>
          <Link
            href={`/admin/calendar?date=${nextDate}`}
            className="rounded-md border px-3 py-1.5 hover:bg-accent"
          >
            {t("calendar.next")} ›
          </Link>
        </div>
        <form method="get" className="flex items-center gap-2 text-sm">
          <input
            type="date"
            name="date"
            defaultValue={date}
            className="border-input rounded-md border px-3 py-1.5"
          />
          <Button type="submit" variant="outline" size="sm">
            {t("calendar.go")}
          </Button>
        </form>
      </div>

      <p className="text-muted-foreground text-sm font-medium">{heading}</p>

      {appointments.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
          {t("calendar.noAppointments")}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {appointments.map((appointment) => {
            const start = formatInTimeZone(
              appointment.startsAt,
              locale,
              timeZone,
              { timeStyle: "short" },
            );
            const end = formatInTimeZone(appointment.endsAt, locale, timeZone, {
              timeStyle: "short",
            });
            return (
              <li key={appointment.id}>
                <Link
                  href={`/admin/appointments/${appointment.id}`}
                  className="hover:bg-accent flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <span className="flex items-center gap-3">
                    <span className="font-medium tabular-nums">
                      {start}–{end}
                    </span>
                    <span>
                      {appointment.patientFirstName}{" "}
                      {appointment.patientLastName}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {t(`source.${appointment.source}`)}
                    </span>
                    <span className="rounded-full border px-2 py-0.5">
                      {t(`status.${appointment.status}`)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
    </AdminShell>
  );
}
