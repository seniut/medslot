import { z } from "zod";

import { SUPPORTED_LOCALES } from "./bookingSchema";

// Server-side validation for rescheduling an existing appointment from the
// admin area. Error messages are stable codes translated in the UI
// (admin.errors namespace). Only the target date/time changes; the appointment
// keeps its identity, patient, and history.

export const rescheduleAppointmentSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
  id: z.string().trim().min(1, "required"),
  // Clinic-local wall-clock date/time; converted to an absolute instant server-side.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalidDate"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "invalidTime"),
});

export type RescheduleAppointmentInput = z.infer<
  typeof rescheduleAppointmentSchema
>;

/** Field-level error codes returned to the client for translation. */
export type RescheduleFieldErrors = Partial<
  Record<keyof RescheduleAppointmentInput, string>
>;

/** State shared by the reschedule server action and the form UI. */
export type RescheduleFormState = {
  fieldErrors: RescheduleFieldErrors;
  /** Stable form-level error code (translated in the UI), or null. */
  formError: string | null;
};

export const initialRescheduleFormState: RescheduleFormState = {
  fieldErrors: {},
  formError: null,
};
