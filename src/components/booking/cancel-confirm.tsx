"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { initialCancelFormState } from "@/lib/validation/cancellationSchema";
import { cancelAppointmentAction } from "@/server/appointments/cancelActions";

type CancelConfirmProps = {
  token: string;
  locale: string;
};

/** Confirmation control for cancelling an appointment via the secure link. */
export function CancelConfirm({ token, locale }: CancelConfirmProps) {
  const t = useTranslations("cancel");
  const tErrors = useTranslations("cancel.errors");
  const [state, formAction, isPending] = useActionState(
    cancelAppointmentAction,
    initialCancelFormState,
  );

  if (state.status === "success") {
    return (
      <div className="space-y-3" role="status">
        <h2 className="text-lg font-semibold">{t("successTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("successMessage")}</p>
        <Link
          href="/booking"
          className="text-sm underline-offset-4 hover:underline"
        >
          {t("rebook")}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <p className="text-sm">{t("confirmPrompt")}</p>
      {state.status === "error" && state.errorCode ? (
        <p role="alert" className="text-destructive text-sm font-medium">
          {tErrors(state.errorCode)}
        </p>
      ) : null}
      <Button type="submit" variant="destructive" disabled={isPending}>
        {isPending ? t("cancelling") : t("confirm")}
      </Button>
    </form>
  );
}
