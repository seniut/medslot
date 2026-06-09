// Typed auth error. User-facing handling happens at the UI boundary; admin
// pages redirect to the login page, admin actions surface a generic code.

export class UnauthorizedError extends Error {
  readonly code = "unauthorized" as const;

  constructor(message?: string) {
    super(message ?? "unauthorized");
    this.name = "UnauthorizedError";
  }
}
