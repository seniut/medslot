import { BOOKING_DEFAULTS } from "@/lib/booking-config";
import { getActiveClinic } from "@/server/clinic/getActiveClinic";

export type BookingContext = {
  clinicId: string;
  clinicName: string;
  doctorId: string;
  doctorName: string;
  /** Doctor's own email — used as the default new-booking notification target. */
  doctorEmail: string;
  /** Clinic default locale — used for clinic/doctor-facing notifications. */
  defaultLocale: string;
  timeZone: string;
};

/**
 * Load the clinic/doctor that accepts public bookings.
 *
 * Tenant resolution is delegated to `getActiveClinic` (the single place that
 * decides which clinic a public request maps to). Returns null when no clinic
 * or doctor is configured yet.
 */
export async function getBookingContext(): Promise<BookingContext | null> {
  const clinic = await getActiveClinic();

  if (!clinic || !clinic.doctor) {
    return null;
  }

  return {
    clinicId: clinic.id,
    clinicName: clinic.name,
    doctorId: clinic.doctor.id,
    doctorName: clinic.doctor.displayName,
    doctorEmail: clinic.doctor.email,
    defaultLocale: clinic.defaultLocale,
    timeZone:
      clinic.doctor.timezone ||
      clinic.timezone ||
      BOOKING_DEFAULTS.fallbackTimeZone,
  };
}
