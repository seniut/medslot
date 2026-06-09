import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminShell } from "@/components/admin/admin-shell";
import { BlockedTimeForm } from "@/components/admin/blocked-time-form";
import { WorkingHoursForm } from "@/components/admin/working-hours-form";
import { Button } from "@/components/ui/button";
import {
  enumerateZonedDates,
  formatInTimeZone,
} from "@/lib/date-time/timezone";
import { getBookingContext } from "@/server/appointments/getBookingContext";
import { deleteBlockedTimeAction } from "@/server/availability/availabilityActions";
import { getUpcomingBlockedTimes } from "@/server/availability/getBlockedTimes";
import { getDoctorWorkingHours } from "@/server/availability/getWorkingHours";
import { requireAdmin } from "@/server/auth/requireAdmin";

export const dynamic = "force-dynamic";

type AdminSettingsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminSettingsPage({
  params,
}: AdminSettingsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await requireAdmin(locale);
  const t = await getTranslations("admin.settings");

  const context = await getBookingContext();
  if (!context || context.clinicId !== session.clinicId) {
    return (
      <AdminShell locale={locale} email={session.email}>
        <section className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("notConfigured")}</p>
        </section>
      </AdminShell>
    );
  }

  const timeZone = context.timeZone;
  const [days, blockedTimes] = await Promise.all([
    getDoctorWorkingHours({
      clinicId: session.clinicId,
      doctorId: context.doctorId,
    }),
    getUpcomingBlockedTimes({
      clinicId: session.clinicId,
      doctorId: context.doctorId,
    }),
  ]);
  const today = enumerateZonedDates(timeZone, new Date(), 1)[0].dateString;

  return (
    <AdminShell locale={locale} email={session.email}>
      <section className="space-y-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{t("workingHoursTitle")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("workingHoursSubtitle")}
            </p>
          </div>
          <WorkingHoursForm locale={locale} days={days} />
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{t("blockedTitle")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("blockedSubtitle")}
            </p>
          </div>
          <BlockedTimeForm locale={locale} defaultDate={today} />

          {blockedTimes.length === 0 ? (
            <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
              {t("noBlocked")}
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {blockedTimes.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <span className="text-sm">
                    <span className="font-medium tabular-nums">
                      {formatInTimeZone(item.startsAt, locale, timeZone, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {" – "}
                      {formatInTimeZone(item.endsAt, locale, timeZone, {
                        timeStyle: "short",
                      })}
                    </span>
                    {item.reason ? (
                      <span className="text-muted-foreground"> · {item.reason}</span>
                    ) : null}
                  </span>
                  <form action={deleteBlockedTimeAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <Button type="submit" variant="outline" size="sm">
                      {t("removeBlocked")}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
