import { z } from "zod";

// Server-side booking validation. Error messages are stable codes that the UI
// translates (see the booking.errors namespace in the i18n message catalogs),
// so validation messages remain localizable.

export const SUPPORTED_LOCALES = ["pl", "en"] as const;

export const bookingSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
  // ISO instants for the chosen slot; availability is re-verified server-side.
  startsAt: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "invalidSlot"),
  endsAt: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "invalidSlot"),
  firstName: z.string().trim().min(1, "required").max(100, "tooLong"),
  lastName: z.string().trim().min(1, "required").max(100, "tooLong"),
  phone: z.string().trim().min(3, "required").max(40, "tooLong"),
  email: z.email("invalidEmail").max(254, "tooLong"),
  // Optional free-text message; deliberately discourages medical detail in UI.
  message: z.string().trim().max(1000, "tooLong").optional(),
  // Privacy/data-processing acceptance is mandatory for public bookings.
  consent: z.literal(true, "consentRequired"),
});

export type BookingInput = z.infer<typeof bookingSchema>;

/** Field-level error codes returned to the client for translation. */
export type BookingFieldErrors = Partial<
  Record<keyof BookingInput, string>
>;

/** State shape shared by the booking server action and the form UI. */
export type BookingFormState = {
  fieldErrors: BookingFieldErrors;
  /** Stable form-level error code (translated in the UI), or null. */
  formError: string | null;
};

export const initialBookingFormState: BookingFormState = {
  fieldErrors: {},
  formError: null,
};
