import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminShell } from "@/components/admin/admin-shell";
import { CopyButton } from "@/components/admin/copy-button";
import { NoteForm } from "@/components/admin/note-form";
import { RescheduleForm } from "@/components/admin/reschedule-form";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatInTimeZone, zonedDateTimeParts } from "@/lib/date-time/timezone";
import {
  cancelByDoctorAction,
  markCompletedAction,
  markNoShowAction,
} from "@/server/appointments/adminActions";
import { getAppointmentDetail } from "@/server/appointments/getAppointmentDetail";
import { requireAdmin } from "@/server/auth/requireAdmin";

export const dynamic = "force-dynamic";

type AppointmentDetailPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function AppointmentDetailPage({
  params,
}: AppointmentDetailPageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await requireAdmin(locale);
  const t = await getTranslations("admin");
  const tNotes = await getTranslations("admin.notes");

  const detail = await getAppointmentDetail({ clinicId: session.clinicId, id });

  return (
    <AdminShell locale={locale} email={session.email}>
      <section className="space-y-6">
        <div>
          <Link
            href="/admin/calendar"
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            ‹ {t("appointment.backToCalendar")}
          </Link>
        </div>

        {!detail ? (
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("appointment.notFoundTitle")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("appointment.notFoundMessage")}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {t("appointment.title")}
              </h1>
              <span className="rounded-full border px-3 py-1 text-sm">
                {t(`status.${detail.status}`)}
              </span>
            </div>

            <dl className="grid gap-4 rounded-md border p-4 sm:grid-cols-2">
              <Row label={t("appointment.when")}>
                {formatInTimeZone(detail.startsAt, locale, detail.timeZone, {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </Row>
              <Row label={t("appointment.source")}>
                {t(`source.${detail.source}`)}
              </Row>
              <Row label={t("appointment.patient")}>
                {detail.patientFirstName} {detail.patientLastName}
              </Row>
              <Row label={t("appointment.phone")}>{detail.patientPhone}</Row>
              <Row label={t("appointment.email")}>
                {detail.patientEmail || "—"}
              </Row>
              <Row label={t("appointment.message")}>
                {detail.patientMessage || t("appointment.noMessage")}
              </Row>
            </dl>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/admin/patients/${detail.patientId}`}
                className="text-sm underline-offset-4 hover:underline"
              >
                {t("appointment.viewPatient")}
              </Link>
              <CopyButton
                text={[
                  formatInTimeZone(detail.startsAt, locale, detail.timeZone, {
                    dateStyle: "long",
                    timeStyle: "short",
                  }),
                  `${detail.patientFirstName} ${detail.patientLastName}`,
                  detail.patientPhone,
                  detail.patientEmail || "",
                  t(`status.${detail.status}`),
                ]
                  .filter(Boolean)
                  .join("\n")}
                label={tNotes("copyVisit")}
                copiedLabel={tNotes("copied")}
              />
            </div>

            {detail.status === "booked" ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <form action={markCompletedAction}>
                    <input type="hidden" name="id" value={detail.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <Button type="submit">
                      {t("appointment.actions.markCompleted")}
                    </Button>
                  </form>
                  <form action={markNoShowAction}>
                    <input type="hidden" name="id" value={detail.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <Button type="submit" variant="secondary">
                      {t("appointment.actions.markNoShow")}
                    </Button>
                  </form>
                  <form action={cancelByDoctorAction}>
                    <input type="hidden" name="id" value={detail.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <Button type="submit" variant="destructive">
                      {t("appointment.actions.cancel")}
                    </Button>
                  </form>
                </div>
                <p className="text-muted-foreground text-xs">
                  {detail.patientEmail
                    ? t("appointment.actions.cancelEmailHint")
                    : t("appointment.actions.cancelNoEmailHint")}
                </p>
                <RescheduleForm
                  locale={locale}
                  appointmentId={detail.id}
                  defaultDate={
                    zonedDateTimeParts(detail.timeZone, detail.startsAt).date
                  }
                  defaultTime={
                    zonedDateTimeParts(detail.timeZone, detail.startsAt).time
                  }
                />
              </div>
            ) : null}

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">{tNotes("title")}</h2>
              {detail.notes.length === 0 ? (
                <p className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
                  {tNotes("empty")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {detail.notes.map((note) => (
                    <li key={note.id} className="rounded-md border p-3 text-sm">
                      <p className="whitespace-pre-wrap">{note.content}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatInTimeZone(
                          note.createdAt,
                          locale,
                          detail.timeZone,
                          {
                            dateStyle: "medium",
                            timeStyle: "short",
                          },
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <NoteForm
                locale={locale}
                patientId={detail.patientId}
                appointmentId={detail.id}
              />
            </div>
          </>
        )}
      </section>
    </AdminShell>
  );
}

type RowProps = {
  label: string;
  children: React.ReactNode;
};

function Row({ label, children }: RowProps) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs font-medium uppercase">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
