import { z } from "zod";

import { SUPPORTED_LOCALES } from "./bookingSchema";

// Server-side validation for patient data-rights actions (GDPR/RODO).
// Anonymization is irreversible, so it requires an explicit confirmation.
// Error messages are stable codes translated in the UI (admin.errors namespace).

export const anonymizePatientSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
  patientId: z.string().trim().min(1, "required"),
  // The confirmation checkbox sends "on" only when ticked.
  confirm: z.literal("on", "confirmRequired"),
});

export type AnonymizePatientInput = z.infer<typeof anonymizePatientSchema>;

/** State shared by the anonymize server action and the form UI. */
export type AnonymizeFormState = {
  /** Stable form-level error code (translated in the UI), or null. */
  formError: string | null;
  /** True after a successful anonymization, so the form can confirm. */
  done: boolean;
};

export const initialAnonymizeFormState: AnonymizeFormState = {
  formError: null,
  done: false,
};
