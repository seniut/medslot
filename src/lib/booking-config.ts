// Booking configuration defaults (MVP) from docs/01-product-spec.md.
//
// These are intentionally simple constants for the MVP. Working hours and
// blocked time are stored per doctor; the values below control slot shape,
// booking notice, and the booking window.

export const BOOKING_DEFAULTS = {
  /** Length of a single appointment, in minutes. */
  durationMinutes: 60,
  /** Spacing between candidate slot start times, in minutes. */
  slotStepMinutes: 30,
  /** Minimum lead time before a slot can be booked, in hours. */
  minNoticeHours: 4,
  /** How far ahead patients can book, in days (including today). */
  bookingWindowDays: 30,
  /** Fallback timezone when a doctor/clinic has none set. */
  fallbackTimeZone: "Europe/Warsaw",
} as const;

/**
 * Version identifier of the privacy/data-processing text shown at booking time.
 * Stored on each ConsentRecord so we know which text the patient accepted.
 * Bump this whenever the patient-facing privacy text changes.
 */
export const PRIVACY_TEXT_VERSION = "2026-06-05";

/** Consent record type for the booking privacy acceptance. */
export const CONSENT_TYPE_BOOKING = "booking_privacy";
