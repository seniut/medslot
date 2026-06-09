import type { Prisma } from "@prisma/client";

export type PatientContactInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
};

/**
 * Find an existing patient within the clinic by email or phone, or create one.
 *
 * Prevents duplicate patient records for the same clinic (docs/03-data-model
 * rule). Soft-deleted patients are ignored. Runs inside the caller's
 * transaction so patient creation and booking are atomic.
 */
export async function findOrCreatePatient(
  tx: Prisma.TransactionClient,
  clinicId: string,
  input: PatientContactInput,
): Promise<{ id: string }> {
  const existing = await tx.patient.findFirst({
    where: {
      clinicId,
      deletedAt: null,
      OR: [{ email: input.email }, { phone: input.phone }],
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return tx.patient.create({
    data: {
      clinicId,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email,
    },
    select: { id: true },
  });
}
