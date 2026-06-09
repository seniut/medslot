import { z } from "zod";

import { SUPPORTED_LOCALES } from "./bookingSchema";

// Server-side validation for the cancellation action. As with booking, error
// messages are stable codes translated in the UI (see the `cancel.errors`
// namespace), so validation remains localizable.

export const cancellationSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
  // Raw cancellation token from the email link (base64url, ~43 chars). We only
  // bound the length here; the real check is whether its hash matches a row.
  token: z.string().trim().min(16, "invalidToken").max(256, "invalidToken"),
});

export type CancellationInput = z.infer<typeof cancellationSchema>;

/** State shared by the cancellation server action and the confirm UI. */
export type CancelFormState = {
  status: "idle" | "success" | "error";
  /** Stable error code (translated in the UI), or null. */
  errorCode: string | null;
};

export const initialCancelFormState: CancelFormState = {
  status: "idle",
  errorCode: null,
};
