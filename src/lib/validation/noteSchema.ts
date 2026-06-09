import { z } from "zod";

import { SUPPORTED_LOCALES } from "./bookingSchema";

// Server-side validation for internal doctor notes. Notes are admin-only and
// may attach to a patient (always) and optionally to a specific appointment.
// Error messages are stable codes translated in the UI (admin.errors namespace).

export const noteSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
  patientId: z.string().trim().min(1, "required"),
  appointmentId: z.string().trim().min(1).optional(),
  content: z.string().trim().min(1, "required").max(5000, "tooLong"),
});

export type NoteInput = z.infer<typeof noteSchema>;

/** Field-level error codes returned to the client for translation. */
export type NoteFieldErrors = Partial<Record<"content", string>>;

/** State shared by the note server action and the form UI. */
export type NoteFormState = {
  fieldErrors: NoteFieldErrors;
  /** Stable form-level error code (translated in the UI), or null. */
  formError: string | null;
  /** True after a successful save, so the form can confirm and reset. */
  saved: boolean;
};

export const initialNoteFormState: NoteFormState = {
  fieldErrors: {},
  formError: null,
  saved: false,
};
