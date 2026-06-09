import type { ReactNode } from "react";

import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminShell } from "@/components/admin/admin-shell";
import { AnonymizePatientForm } from "@/components/admin/anonymize-patient-form";
import { CopyButton } from "@/components/admin/copy-button";
import { NoteForm } from "@/components/admin/note-form";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatInTimeZone } from "@/lib/date-time/timezone";
import { getBookingContext } from "@/server/appointments/getBookingContext";
import { requireAdmin } from "@/server/auth/requireAdmin";
import { getPatientDetail } from "@/server/patients/getPatientDetail";

export const dynamic = "force-dynamic";

type PatientDetailPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function PatientDetailPage({
  params,
}: PatientDetailPageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await requireAdmin(locale);
  const t = await getTranslations("admin.patients");
  const tNotes = await getTranslations("admin.notes");
  const tStatus = await getTranslations("admin.status");
  const tSource = await getTranslations("admin.source");

  const context = await getBookingContext();
  const timeZone = context?.timeZone ?? "Europe/Warsaw";

  const patient = await getPatientDetail({
    clinicId: session.clinicId,
    patientId: id,
  });

  return (
    <AdminShell locale={locale} email={session.email}>
      <section className="space-y-6">
        <div>
          <Link
            href="/admin/patients"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ‹ {t("backToPatients")}
          </Link>
        </div>

        {!patient ? (
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("notFoundTitle")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("notFoundMessage")}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {patient.firstName} {patient.lastName}
                </h1>
                {patient.anonymizedAt ? (
                  <span className="text-muted-foreground rounded-full border px-2 py-0.5 text-xs">
                    {t("anonymizedBadge")}
                  </span>
                ) : null}
              </div>
              {patient.anonymizedAt ? null : (
                <CopyButton
                  text={`${patient.firstName} ${patient.lastName}\n${patient.phone}${
                    patient.email ? `\n${patient.email}` : ""
                  }`}
                  label={t("copyContact")}
                  copiedLabel={t("copied")}
                />
              )}
            </div>

            <dl className="grid gap-4 rounded-md border p-4 sm:grid-cols-2">
              <Row label={t("phone")}>{patient.phone}</Row>
              <Row label={t("email")}>{patient.email || "—"}</Row>
            </dl>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">{t("historyTitle")}</h2>
              {patient.visits.length === 0 ? (
                <p className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
                  {t("noHistory")}
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {patient.visits.map((visit) => (
                    <li key={visit.id}>
                      <Link
                        href={`/admin/appointments/${visit.id}`}
                        className="hover:bg-accent flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                      >
                        <span className="text-sm font-medium tabular-nums">
                          {formatInTimeZone(visit.startsAt, locale, timeZone, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                        <span className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">
                            {tSource(visit.source)}
                          </span>
                          <span className="rounded-full border px-2 py-0.5">
                            {tStatus(visit.status)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">{tNotes("title")}</h2>
              {patient.notes.length === 0 ? (
                <p className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
                  {tNotes("empty")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {patient.notes.map((note) => (
                    <li
                      key={note.id}
                      className="rounded-md border p-3 text-sm"
                    >
                      <p className="whitespace-pre-wrap">{note.content}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatInTimeZone(note.createdAt, locale, timeZone, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                        {note.appointmentId ? ` · ${tNotes("forVisit")}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {patient.anonymizedAt ? null : (
                <NoteForm locale={locale} patientId={patient.id} />
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">{t("dataTitle")}</h2>
              <p className="text-muted-foreground text-sm">
                {t("dataSubtitle")}
              </p>
              <div className="space-y-4 rounded-md border p-4">
                <Button asChild variant="outline">
                  <a
                    href={`/api/admin/patients/${patient.id}/export`}
                    download
                  >
                    {t("exportData")}
                  </a>
                </Button>
                <div className="space-y-2 border-t pt-4">
                  <h3 className="text-sm font-semibold">
                    {t("anonymizeTitle")}
                  </h3>
                  {patient.anonymizedAt ? (
                    <p className="text-muted-foreground text-sm">
                      {t("anonymizedNotice")}
                    </p>
                  ) : (
                    <AnonymizePatientForm
                      locale={locale}
                      patientId={patient.id}
                    />
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </AdminShell>
  );
}
