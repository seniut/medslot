import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminShell } from "@/components/admin/admin-shell";
import { ManualAppointmentForm } from "@/components/admin/manual-appointment-form";
import { Link } from "@/i18n/navigation";
import { enumerateZonedDates } from "@/lib/date-time/timezone";
import { getBookingContext } from "@/server/appointments/getBookingContext";
import { requireAdmin } from "@/server/auth/requireAdmin";

export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type NewAppointmentPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string }>;
};

export default async function NewAppointmentPage({
  params,
  searchParams,
}: NewAppointmentPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await requireAdmin(locale);
  const t = await getTranslations("admin.manual");

  const context = await getBookingContext();
  const timeZone = context?.timeZone ?? "Europe/Warsaw";
  const today = enumerateZonedDates(timeZone, new Date(), 1)[0].dateString;

  const { date: dateParam } = await searchParams;
  const defaultDate =
    dateParam && ISO_DATE.test(dateParam) ? dateParam : today;

  return (
    <AdminShell locale={locale} email={session.email}>
      <section className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/admin/calendar"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          ‹ {t("backToCalendar")}
        </Link>
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>
      <ManualAppointmentForm locale={locale} defaultDate={defaultDate} />
    </section>
    </AdminShell>
  );
}
