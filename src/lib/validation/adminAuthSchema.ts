import { z } from "zod";

import { SUPPORTED_LOCALES } from "./bookingSchema";

// Admin sign-in validation. All failures collapse to a single generic
// "invalidCredentials" code so the UI never reveals whether an email exists.

export const loginSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
  email: z.email("invalidCredentials").max(254, "invalidCredentials"),
  password: z.string().min(1, "invalidCredentials").max(200, "invalidCredentials"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** State shared by the login server action and the login form UI. */
export type LoginFormState = {
  /** Stable error code (translated in the UI), or null. */
  error: string | null;
};

export const initialLoginFormState: LoginFormState = {
  error: null,
};
