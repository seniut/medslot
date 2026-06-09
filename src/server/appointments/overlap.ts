import { Prisma } from "@prisma/client";

/**
 * Detect a PostgreSQL exclusion-constraint violation from the appointment
 * no-overlap rule (`appointment_no_overlap`). This is the database's final
 * authority on double-booking; callers translate it into SlotUnavailableError.
 */
export function isNoOverlapViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("appointment_no_overlap") ||
    message.includes("23P01") ||
    message.includes("exclusion constraint")
  ) {
    return true;
  }
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2010" &&
    message.includes("appointment_no_overlap")
  );
}
