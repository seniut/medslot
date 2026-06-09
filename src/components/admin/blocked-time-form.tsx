"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  initialBlockedTimeFormState,
  type BlockedTimeFormState,
} from "@/lib/validation/blockedTimeSchema";
import { createBlockedTimeAction } from "@/server/availability/availabilityActions";

type BlockedTimeFormProps = {
  locale: string;
  defaultDate: string;
};

export function BlockedTimeForm({ locale, defaultDate }: BlockedTimeFormProps) {
  const t = useTranslations("admin.settings");
  const tErrors = useTranslations("admin.errors");
  const [state, formAction, isPending] = useActionState<
    BlockedTimeFormState,
    FormData
  >(createBlockedTimeAction, initialBlockedTimeFormState);

  const fieldError = (field: string) => {
    const code = state.fieldErrors[field as keyof typeof state.fieldErrors];
    return code ? tErrors(code) : null;
  };

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("blockedDate")} error={fieldError("date")}>
          <input
            name="date"
            type="date"
            defaultValue={defaultDate}
            required
            className="border-input w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t("blockedReason")} error={fieldError("reason")}>
          <input
            name="reason"
            type="text"
            autoComplete="off"
            placeholder={t("blockedReasonPlaceholder")}
            className="border-input w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t("blockedFrom")} error={fieldError("startTime")}>
          <input
            name="startTime"
            type="time"
            required
            className="border-input w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t("blockedTo")} error={fieldError("endTime")}>
          <input
            name="endTime"
            type="time"
            required
            className="border-input w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>
      </div>

      {state.formError ? (
        <p role="alert" className="text-destructive text-sm">
          {tErrors(state.formError)}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-sm font-medium text-green-600">
          {t("blockedAdded")}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? t("addingBlocked") : t("addBlocked")}
      </Button>
    </form>
  );
}

type FieldProps = {
  label: string;
  error: string | null;
  children: React.ReactNode;
};

function Field({ label, error, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
