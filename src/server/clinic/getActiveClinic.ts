import { prisma } from "@/db/prisma";

export type ActiveClinicDoctor = {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
  timezone: string;
};

export type ActiveClinic = {
  id: string;
  name: string;
  slug: string;
  defaultLocale: string;
  timezone: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  doctor: ActiveClinicDoctor | null;
};

/**
 * Resolve the "active" clinic for a public (patient-facing) request.
 *
 * This is the SINGLE place that maps an incoming public request to a clinic.
 * The MVP is single-tenant, so it returns the earliest-created clinic and its
 * earliest-created doctor.
 *
 * To grow into a multi-tenant platform (many clinics, one deployment), change
 * ONLY this resolver — e.g. accept a `slug` from the URL (`/[clinic]/...`) or a
 * hostname and look the clinic up by it. Every public read model
 * (`getClinicProfile`, `getBookingContext`) is built on top of this function,
 * so they all follow automatically. See `docs/12-multi-tenancy.md`.
 *
 * Only non-sensitive clinic/doctor fields are returned — never patient data.
 */
export async function getActiveClinic(): Promise<ActiveClinic | null> {
  const clinic = await prisma.clinic.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      doctors: { orderBy: { createdAt: "asc" }, take: 1 },
    },
  });

  if (!clinic) {
    return null;
  }

  const doctor = clinic.doctors[0] ?? null;

  return {
    id: clinic.id,
    name: clinic.name,
    slug: clinic.slug,
    defaultLocale: clinic.defaultLocale,
    timezone: clinic.timezone,
    phone: clinic.phone,
    email: clinic.email,
    address: clinic.address,
    doctor: doctor
      ? {
          id: doctor.id,
          displayName: doctor.displayName,
          email: doctor.email,
          phone: doctor.phone,
          timezone: doctor.timezone,
        }
      : null,
  };
}
