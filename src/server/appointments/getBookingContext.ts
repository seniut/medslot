import { prisma } from "@/db/prisma";
import { BOOKING_DEFAULTS } from "@/lib/booking-config";

export type BookingContext = {
  clinicId: string;
  clinicName: string;
  doctorId: string;
  doctorName: string;
  timeZone: string;
};

/**
 * Load the clinic/doctor that accepts public bookings.
 *
 * MVP is single-doctor, so we use the earliest-created doctor and its clinic.
 * Returns null when no doctor is configured yet.
 */
export async function getBookingContext(): Promise<BookingContext | null> {
  const doctor = await prisma.doctor.findFirst({
    orderBy: { createdAt: "asc" },
    include: { clinic: true },
  });

  if (!doctor) {
    return null;
  }

  return {
    clinicId: doctor.clinicId,
    clinicName: doctor.clinic.name,
    doctorId: doctor.id,
    doctorName: doctor.displayName,
    timeZone:
      doctor.timezone ||
      doctor.clinic.timezone ||
      BOOKING_DEFAULTS.fallbackTimeZone,
  };
}
