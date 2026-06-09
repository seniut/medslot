import { getActiveClinic } from "@/server/clinic/getActiveClinic";

export type ClinicProfile = {
  name: string;
  doctorName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};

/**
 * Public-facing clinic profile for the landing page.
 *
 * Tenant resolution is delegated to `getActiveClinic` (the single place that
 * decides which clinic a public request maps to). Only non-sensitive,
 * intentionally public fields are returned — never patient data.
 */
export async function getClinicProfile(): Promise<ClinicProfile | null> {
  const clinic = await getActiveClinic();

  if (!clinic) {
    return null;
  }

  return {
    name: clinic.name,
    doctorName: clinic.doctor?.displayName ?? null,
    phone: clinic.phone,
    email: clinic.email,
    address: clinic.address,
  };
}
