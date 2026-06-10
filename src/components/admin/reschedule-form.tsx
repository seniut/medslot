"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  initialRescheduleFormState,
  type RescheduleFormState,
} from "@/lib/validation/rescheduleAppointmentSchema";
import { rescheduleAction } from "@/server/appointments/adminActions";

type RescheduleFormProps = {
  locale: string;
  appointmentId: string;
  defaultDate: string;
  defaultTime: string;
};

export function RescheduleForm({
  locale,
  appointmentId,
  defaultDate,
  defaultTime,
}: RescheduleFormProps) {
  const t = useTranslations("admin.appointment.actions");
  const tErrors = useTranslations("admin.errors");
  const [state, formAction, isPending] = useActionState<
    RescheduleFormState,
    FormData
  >(rescheduleAction, initialRescheduleFormState);

  const fieldError = (field: string) => {
    const code = state.fieldErrors[field as keyof typeof state.fieldErrors];
    return code ? tErrors(code) : null;
  };

  return (
    <form action={formAction} className="space-y-3 rounded-md border p-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={appointmentId} />

      <div>
        <h3 className="text-sm font-semibold">{t("rescheduleTitle")}</h3>
        <p className="text-muted-foreground text-xs">{t("rescheduleHint")}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="reschedule-date" className="text-sm font-medium">
            {t("rescheduleDate")}
          </label>
          <input
            id="reschedule-date"
            name="date"
            type="date"
            defaultValue={defaultDate}
            required
            className="border-input block rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="reschedule-time" className="text-sm font-medium">
            {t("rescheduleTime")}
          </label>
          <input
            id="reschedule-time"
            name="time"
            type="time"
            defaultValue={defaultTime}
            required
            className="border-input block rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? t("rescheduleSubmitting") : t("rescheduleSubmit")}
        </Button>
      </div>

      {fieldError("date") ? (
        <p role="alert" className="text-destructive text-sm">
          {fieldError("date")}
        </p>
      ) : null}
      {fieldError("time") ? (
        <p role="alert" className="text-destructive text-sm">
          {fieldError("time")}
        </p>
      ) : null}
      {state.formError ? (
        <p role="alert" className="text-destructive text-sm">
          {tErrors(state.formError)}
        </p>
      ) : null}
    </form>
  );
}
