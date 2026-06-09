import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminShell } from "@/components/admin/admin-shell";
import { ExportForm } from "@/components/admin/export-form";
import { Link } from "@/i18n/navigation";
import {
  enumerateZonedDates,
  formatInTimeZone,
  shiftIsoDate,
} from "@/lib/date-time/timezone";
import { getBookingContext } from "@/server/appointments/getBookingContext";
import { requireAdmin } from "@/server/auth/requireAdmin";
import { listPatients } from "@/server/patients/getPatients";

export const dynamic = "force-dynamic";

type AdminPatientsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminPatientsPage({
  params,
}: AdminPatientsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await requireAdmin(locale);
  const t = await getTranslations("admin.patients");

  const context = await getBookingContext();
  const timeZone = context?.timeZone ?? "Europe/Warsaw";
  const today = enumerateZonedDates(timeZone, new Date(), 1)[0].dateString;
  const defaultFrom = shiftIsoDate(today, -30);

  const patients = await listPatients({ clinicId: session.clinicId });

  return (
    <AdminShell locale={locale} email={session.email}>
      <section className="space-y-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{t("exportTitle")}</h2>
            <p className="text-muted-foreground text-sm">{t("exportSubtitle")}</p>
          </div>
          <ExportForm defaultFrom={defaultFrom} defaultTo={today} />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("listTitle")}</h2>
          {patients.length === 0 ? (
            <p className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
              {t("noPatients")}
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {patients.map((patient) => (
                <li key={patient.id}>
                  <Link
                    href={`/admin/patients/${patient.id}`}
                    className="hover:bg-accent flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <span className="text-sm">
                      <span className="font-medium">
                        {patient.firstName} {patient.lastName}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {patient.phone}
                      </span>
                      {patient.anonymizedAt ? (
                        <span className="text-muted-foreground ml-2 rounded-full border px-2 py-0.5 text-xs">
                          {t("anonymizedBadge")}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {t("visits", { count: patient.visitCount })}
                      {patient.lastVisitAt
                        ? ` · ${t("lastVisit")}: ${formatInTimeZone(
                            patient.lastVisitAt,
                            locale,
                            timeZone,
                            { dateStyle: "medium" },
                          )}`
                        : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
