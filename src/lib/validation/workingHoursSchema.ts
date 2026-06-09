import { SUPPORTED_LOCALES } from "./bookingSchema";

// Server-side validation for the weekly working-hours editor. One window per
// weekday in the MVP UI (the data model and availability engine support more).
// Error messages are stable codes translated in the UI (admin.errors namespace).

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Re-exported so callers share the same locale source of truth. */
export { SUPPORTED_LOCALES };

const TIME_RE = /^\d{2}:\d{2}$/;

/** One editable working-hours row for a single weekday. */
export type WorkingDayInput = {
  dayOfWeek: number;
  isActive: boolean;
  startTime: string;
  endTime: string;
};

/** Field-level error codes keyed by `dayOfWeek` (translated in the UI). */
export type WorkingHoursFieldErrors = Record<number, string>;

/** State shared by the working-hours server action and the form UI. */
export type WorkingHoursFormState = {
  fieldErrors: WorkingHoursFieldErrors;
  /** Stable form-level error code (translated in the UI), or null. */
  formError: string | null;
  /** True after a successful save, so the form can confirm it. */
  saved: boolean;
};

export const initialWorkingHoursFormState: WorkingHoursFormState = {
  fieldErrors: {},
  formError: null,
  saved: false,
};

/**
 * Validate the submitted weekday rows. Every row must carry a well-formed
 * `HH:MM` start and end (the inputs are pre-filled), and active days must end
 * after they start. Returns a map of `dayOfWeek -> error code` (empty if valid).
 */
export function validateWorkingDays(
  days: WorkingDayInput[],
): WorkingHoursFieldErrors {
  const errors: WorkingHoursFieldErrors = {};
  for (const day of days) {
    if (!TIME_RE.test(day.startTime) || !TIME_RE.test(day.endTime)) {
      errors[day.dayOfWeek] = "invalidTime";
      continue;
    }
    if (day.isActive && day.startTime >= day.endTime) {
      errors[day.dayOfWeek] = "endBeforeStart";
    }
  }
  return errors;
}
