"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  initialManualAppointmentFormState,
  type ManualAppointmentFormState,
} from "@/lib/validation/manualAppointmentSchema";
import { createManualAppointmentAction } from "@/server/appointments/adminActions";

type ManualAppointmentFormProps = {
  locale: string;
  defaultDate: string;
};

export function ManualAppointmentForm({
  locale,
  defaultDate,
}: ManualAppointmentFormProps) {
  const t = useTranslations("admin.manual");
  const tErrors = useTranslations("admin.errors");
  const [state, formAction, isPending] = useActionState<
    ManualAppointmentFormState,
    FormData
  >(createManualAppointmentAction, initialManualAppointmentFormState);

  const fieldError = (field: string) => {
    const code = state.fieldErrors[field as keyof typeof state.fieldErrors];
    return code ? tErrors(code) : null;
  };

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("date")} error={fieldError("date")}>
          <input
            name="date"
            type="date"
            defaultValue={defaultDate}
            required
            className="border-input w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t("time")} error={fieldError("time")}>
          <input
            name="time"
            type="time"
            required
            className="border-input w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t("firstName")} error={fieldError("firstName")}>
          <input
            name="firstName"
            type="text"
            autoComplete="off"
            required
            className="border-input w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t("lastName")} error={fieldError("lastName")}>
          <input
            name="lastName"
            type="text"
            autoComplete="off"
            required
            className="border-input w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t("phone")} error={fieldError("phone")}>
          <input
            name="phone"
            type="tel"
            autoComplete="off"
            required
            className="border-input w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t("email")} error={fieldError("email")}>
          <input
            name="email"
            type="email"
            autoComplete="off"
            className="border-input w-full rounded-md border px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <div className="space-y-1">
        <label htmlFor="message" className="text-sm font-medium">
          {t("message")}
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          className="border-input w-full rounded-md border px-3 py-2 text-sm"
        />
        <p className="text-muted-foreground text-xs">{t("messageWarning")}</p>
        {fieldError("message") ? (
          <p role="alert" className="text-destructive text-sm">
            {fieldError("message")}
          </p>
        ) : null}
      </div>

      {state.formError ? (
        <p role="alert" className="text-destructive text-sm">
          {tErrors(state.formError)}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? t("submitting") : t("submit")}
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
