import { z } from "zod";

import { SUPPORTED_LOCALES } from "./bookingSchema";

// Server-side validation for creating a blocked-time interval. The doctor picks
// a calendar date plus a start/end wall-clock time (converted to absolute UTC
// instants server-side in the clinic timezone). Error messages are stable codes
// translated in the UI (admin.errors namespace).

export const blockedTimeSchema = z
  .object({
    locale: z.enum(SUPPORTED_LOCALES),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalidDate"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "invalidTime"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "invalidTime"),
    reason: z.string().trim().max(200, "tooLong").optional(),
  })
  .refine((value) => value.startTime < value.endTime, {
    message: "endBeforeStart",
    path: ["endTime"],
  });

export type BlockedTimeInput = z.infer<typeof blockedTimeSchema>;

/** Field-level error codes returned to the client for translation. */
export type BlockedTimeFieldErrors = Partial<
  Record<"date" | "startTime" | "endTime" | "reason", string>
>;

/** State shared by the blocked-time server action and the form UI. */
export type BlockedTimeFormState = {
  fieldErrors: BlockedTimeFieldErrors;
  /** Stable form-level error code (translated in the UI), or null. */
  formError: string | null;
  /** True after a successful add, so the form can confirm it. */
  saved: boolean;
};

export const initialBlockedTimeFormState: BlockedTimeFormState = {
  fieldErrors: {},
  formError: null,
  saved: false,
};
