"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { SlotPicker } from "@/components/booking/slot-picker";
import { BookingForm } from "@/components/booking/booking-form";
import type { Slot } from "@/server/appointments/getAvailability";

type BookingPanelProps = {
  slots: Slot[];
  locale: string;
  timeZone: string;
};

/**
 * Client orchestrator: holds the selected slot and reveals the booking form.
 * The parent page remounts this panel per day (via React key) so selection
 * resets when the patient changes the date.
 */
export function BookingPanel({ slots, locale, timeZone }: BookingPanelProps) {
  const t = useTranslations("booking");
  const [selected, setSelected] = useState<Slot | null>(null);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{t("selectTime")}</h2>
        <SlotPicker
          slots={slots}
          selected={selected}
          onSelect={setSelected}
          locale={locale}
          timeZone={timeZone}
        />
      </div>

      {selected ? (
        <BookingForm slot={selected} locale={locale} timeZone={timeZone} />
      ) : null}
    </div>
  );
}
