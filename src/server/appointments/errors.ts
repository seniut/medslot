// Typed domain errors for the appointments module. User-facing messages are
// localized at the UI boundary using the error `code`.

export type AppointmentErrorCode =
  | "slotUnavailable"
  | "appointmentNotFound"
  | "appointmentNotCancellable"
  | "bookingNotConfigured"
  | "validation";

export class AppointmentError extends Error {
  readonly code: AppointmentErrorCode;

  constructor(code: AppointmentErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AppointmentError";
    this.code = code;
  }
}

/** Raised when a requested slot is not (or no longer) available. */
export class SlotUnavailableError extends AppointmentError {
  constructor(message?: string) {
    super("slotUnavailable", message);
    this.name = "SlotUnavailableError";
  }
}

/** Raised when no clinic/doctor is configured to accept public bookings. */
export class BookingNotConfiguredError extends AppointmentError {
  constructor(message?: string) {
    super("bookingNotConfigured", message);
    this.name = "BookingNotConfiguredError";
  }
}

/** Raised when no appointment matches the provided cancellation token. */
export class AppointmentNotFoundError extends AppointmentError {
  constructor(message?: string) {
    super("appointmentNotFound", message);
    this.name = "AppointmentNotFoundError";
  }
}

/** Raised when an appointment exists but can no longer be cancelled. */
export class AppointmentNotCancellableError extends AppointmentError {
  constructor(message?: string) {
    super("appointmentNotCancellable", message);
    this.name = "AppointmentNotCancellableError";
  }
}
