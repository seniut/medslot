import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatInTimeZone } from "@/lib/date-time/timezone";

type DateSelectorProps = {
  /** Available day keys in `YYYY-MM-DD` form. */
  days: string[];
  selectedDate: string | null;
  locale: string;
  timeZone: string;
};

/**
 * Horizontal list of bookable days. Each day links back to the booking page
 * with a `date` query param so availability is recomputed on the server.
 */
export function DateSelector({
  days,
  selectedDate,
  locale,
  timeZone,
}: DateSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2" role="list">
      {days.map((day) => {
        const isSelected = day === selectedDate;
        // Anchor at noon UTC to keep the calendar date stable across zones.
        const label = formatInTimeZone(
          new Date(`${day}T12:00:00.000Z`),
          locale,
          timeZone,
          { weekday: "short", day: "numeric", month: "short" },
        );
        return (
          <Link
            key={day}
            href={{ pathname: "/booking", query: { date: day } }}
            role="listitem"
            aria-current={isSelected ? "date" : undefined}
            className={cn(
              "inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium transition-colors",
              isSelected
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
