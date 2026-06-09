"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  initialWorkingHoursFormState,
  type WorkingHoursFormState,
} from "@/lib/validation/workingHoursSchema";
import type { WeekdayHours } from "@/server/availability/getWorkingHours";
import { updateWorkingHoursAction } from "@/server/availability/availabilityActions";

type WorkingHoursFormProps = {
  locale: string;
  days: WeekdayHours[];
};

export function WorkingHoursForm({ locale, days }: WorkingHoursFormProps) {
  const t = useTranslations("admin.settings");
  const tErrors = useTranslations("admin.errors");
  const [state, formAction, isPending] = useActionState<
    WorkingHoursFormState,
    FormData
  >(updateWorkingHoursAction, initialWorkingHoursFormState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      <div className="divide-y rounded-md border">
        {days.map((day) => {
          const error = state.fieldErrors[day.dayOfWeek];
          return (
            <div
              key={day.dayOfWeek}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
            >
              <label className="flex w-36 items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  name={`active-${day.dayOfWeek}`}
                  defaultChecked={day.isActive}
                  className="size-4"
                />
                {t(`weekdays.${day.dayOfWeek}`)}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t("startTime")}</span>
                <input
                  type="time"
                  name={`start-${day.dayOfWeek}`}
                  defaultValue={day.startTime}
                  className="border-input rounded-md border px-3 py-1.5"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t("endTime")}</span>
                <input
                  type="time"
                  name={`end-${day.dayOfWeek}`}
                  defaultValue={day.endTime}
                  className="border-input rounded-md border px-3 py-1.5"
                />
              </label>
              {error ? (
                <span role="alert" className="text-destructive text-sm">
                  {tErrors(error)}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {state.formError ? (
        <p role="alert" className="text-destructive text-sm">
          {tErrors(state.formError)}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-sm font-medium text-green-600">
          {t("saved")}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
