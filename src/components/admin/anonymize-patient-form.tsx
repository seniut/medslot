"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  initialAnonymizeFormState,
  type AnonymizeFormState,
} from "@/lib/validation/patientSchema";
import { anonymizePatientAction } from "@/server/patients/patientActions";

type AnonymizePatientFormProps = {
  locale: string;
  patientId: string;
};

/**
 * Destructive, confirmation-gated form that anonymizes a patient's personal
 * data (GDPR/RODO erasure). The action re-validates and re-checks server-side.
 */
export function AnonymizePatientForm({
  locale,
  patientId,
}: AnonymizePatientFormProps) {
  const t = useTranslations("admin.patients");
  const tErrors = useTranslations("admin.errors");
  const [state, formAction, isPending] = useActionState<
    AnonymizeFormState,
    FormData
  >(anonymizePatientAction, initialAnonymizeFormState);

  if (state.done) {
    return (
      <p role="status" className="text-sm font-medium text-green-600">
        {t("anonymizeDone")}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="patientId" value={patientId} />

      <p className="text-muted-foreground text-sm">{t("anonymizeWarning")}</p>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm" value="on" className="mt-1" />
        <span>{t("anonymizeConfirm")}</span>
      </label>

      {state.formError ? (
        <p role="alert" className="text-destructive text-sm">
          {tErrors(state.formError)}
        </p>
      ) : null}

      <Button type="submit" variant="destructive" disabled={isPending}>
        {isPending ? t("anonymizing") : t("anonymizeCta")}
      </Button>
    </form>
  );
}
