"use client";

import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  initialBookingFormState,
  type BookingFieldErrors,
} from "@/lib/validation/bookingSchema";
import { formatInTimeZone } from "@/lib/date-time/timezone";
import { Link } from "@/i18n/navigation";
import { createBookingAction } from "@/server/appointments/actions";
import type { Slot } from "@/server/appointments/getAvailability";

type BookingFormProps = {
  slot: Slot;
  locale: string;
  timeZone: string;
};

const inputClass =
  "w-full rounded-md border bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-[invalid=true]:border-destructive";

/** Public booking form for the selected slot, backed by a server action. */
export function BookingForm({ slot, locale, timeZone }: BookingFormProps) {
  const t = useTranslations("booking");
  const tErrors = useTranslations("booking.errors");
  const [state, formAction, isPending] = useActionState(
    createBookingAction,
    initialBookingFormState,
  );
  const fieldId = useId();

  const errorFor = (field: keyof BookingFieldErrors) => {
    const code = state.fieldErrors[field];
    return code ? tErrors(code) : null;
  };

  const slotLabel = formatInTimeZone(new Date(slot.startsAt), locale, timeZone, {
    dateStyle: "long",
    timeStyle: "short",
  });

  const renderError = (field: keyof BookingFieldErrors) => {
    const message = errorFor(field);
    if (!message) return null;
    return (
      <p id={`${fieldId}-${field}-error`} className="text-destructive text-sm">
        {message}
      </p>
    );
  };

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="startsAt" value={slot.startsAt} />
      <input type="hidden" name="endsAt" value={slot.endsAt} />

      <p className="text-sm font-medium">
        {t("selectedSlot", { datetime: slotLabel })}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-firstName`} className="text-sm font-medium">
            {t("firstName")}
          </label>
          <input
            id={`${fieldId}-firstName`}
            name="firstName"
            type="text"
            autoComplete="given-name"
            required
            maxLength={100}
            aria-invalid={Boolean(state.fieldErrors.firstName)}
            className={inputClass}
          />
          {renderError("firstName")}
        </div>

        <div className="space-y-1">
          <label htmlFor={`${fieldId}-lastName`} className="text-sm font-medium">
            {t("lastName")}
          </label>
          <input
            id={`${fieldId}-lastName`}
            name="lastName"
            type="text"
            autoComplete="family-name"
            required
            maxLength={100}
            aria-invalid={Boolean(state.fieldErrors.lastName)}
            className={inputClass}
          />
          {renderError("lastName")}
        </div>

        <div className="space-y-1">
          <label htmlFor={`${fieldId}-phone`} className="text-sm font-medium">
            {t("phone")}
          </label>
          <input
            id={`${fieldId}-phone`}
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            maxLength={40}
            aria-invalid={Boolean(state.fieldErrors.phone)}
            className={inputClass}
          />
          {renderError("phone")}
        </div>

        <div className="space-y-1">
          <label htmlFor={`${fieldId}-email`} className="text-sm font-medium">
            {t("email")}
          </label>
          <input
            id={`${fieldId}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            aria-invalid={Boolean(state.fieldErrors.email)}
            className={inputClass}
          />
          {renderError("email")}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor={`${fieldId}-message`} className="text-sm font-medium">
          {t("message")}
        </label>
        <textarea
          id={`${fieldId}-message`}
          name="message"
          rows={3}
          maxLength={1000}
          aria-invalid={Boolean(state.fieldErrors.message)}
          className={inputClass}
        />
        <p className="text-muted-foreground text-xs">{t("messageWarning")}</p>
        {renderError("message")}
      </div>

      <div className="space-y-1">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="consent"
            value="true"
            className="mt-1"
            aria-invalid={Boolean(state.fieldErrors.consent)}
          />
          <span>{t("consentText")}</span>
        </label>
        <p className="text-muted-foreground text-xs">
          <Link href="/privacy" target="_blank" className="underline">
            {t("privacyLinkLabel")}
          </Link>
        </p>
        {renderError("consent")}
      </div>

      {state.formError ? (
        <p role="alert" className="text-destructive text-sm font-medium">
          {tErrors(state.formError)}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
