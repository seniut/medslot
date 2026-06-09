"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { Slot } from "@/server/appointments/getAvailability";
import { formatInTimeZone } from "@/lib/date-time/timezone";

type SlotPickerProps = {
  slots: Slot[];
  selected: Slot | null;
  onSelect: (slot: Slot) => void;
  locale: string;
  timeZone: string;
};

/** Grid of selectable time slots for the chosen day. */
export function SlotPicker({
  slots,
  selected,
  onSelect,
  locale,
  timeZone,
}: SlotPickerProps) {
  const t = useTranslations("booking");

  if (slots.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("noSlots")}</p>;
  }

  return (
    <div
      className="grid grid-cols-3 gap-2 sm:grid-cols-4"
      role="listbox"
      aria-label={t("selectTime")}
    >
      {slots.map((slot) => {
        const isSelected = selected?.startsAt === slot.startsAt;
        const label = formatInTimeZone(
          new Date(slot.startsAt),
          locale,
          timeZone,
          { hour: "2-digit", minute: "2-digit" },
        );
        return (
          <Button
            key={slot.startsAt}
            type="button"
            variant={isSelected ? "default" : "outline"}
            aria-selected={isSelected}
            role="option"
            onClick={() => onSelect(slot)}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
