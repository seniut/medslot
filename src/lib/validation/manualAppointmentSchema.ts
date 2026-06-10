import { z } from "zod";

import { SUPPORTED_LOCALES } from "./bookingSchema";

// Server-side validation for manual (admin-created) appointments. Error
// messages are stable codes translated in the UI (admin.errors namespace).
// Email is optional for manual entries (phone bookings may lack an email).

export const manualAppointmentSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
  // Clinic-local wall-clock date/time; converted to an absolute instant server-side.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalidDate"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "invalidTime"),
  firstName: z.string().trim().min(1, "required").max(100, "tooLong"),
  lastName: z.string().trim().min(1, "required").max(100, "tooLong"),
  phone: z.string().trim().min(3, "required").max(40, "tooLong"),
  email: z.email("invalidEmail").max(254, "tooLong").optional(),
  message: z.string().trim().max(1000, "tooLong").optional(),
  // When true and an email is present, the patient is emailed a confirmation
  // (with a cancellation link). Ignored when no email is provided.
  notifyPatient: z.boolean().optional(),
});

export type ManualAppointmentInput = z.infer<typeof manualAppointmentSchema>;

/** Field-level error codes returned to the client for translation. */
export type ManualAppointmentFieldErrors = Partial<
  Record<keyof ManualAppointmentInput, string>
>;

/** State shared by the manual-appointment server action and the form UI. */
export type ManualAppointmentFormState = {
  fieldErrors: ManualAppointmentFieldErrors;
  /** Stable form-level error code (translated in the UI), or null. */
  formError: string | null;
};

export const initialManualAppointmentFormState: ManualAppointmentFormState = {
  fieldErrors: {},
  formError: null,
};
