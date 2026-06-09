import type { Prisma } from "@prisma/client";

import { sha256Hex } from "@/lib/security/hashing";

export type CreateConsentRecordInput = {
  clinicId: string;
  patientId: string;
  appointmentId: string;
  type: string;
  textVersion: string;
  /** Raw IP address; stored only as a hash, if provided. */
  ipAddress?: string | null;
  /** Raw user-agent; stored only as a hash, if provided. */
  userAgent?: string | null;
};

/**
 * Persist a consent/privacy acceptance record for a booking.
 *
 * Raw IP and user-agent are never stored — only salted-free SHA-256 hashes,
 * and only when provided (data minimization, docs/04-gdpr-rodo).
 */
export async function createConsentRecord(
  tx: Prisma.TransactionClient,
  input: CreateConsentRecordInput,
): Promise<void> {
  await tx.consentRecord.create({
    data: {
      clinicId: input.clinicId,
      patientId: input.patientId,
      appointmentId: input.appointmentId,
      type: input.type,
      textVersion: input.textVersion,
      ipAddressHash: input.ipAddress ? sha256Hex(input.ipAddress) : null,
      userAgentHash: input.userAgent ? sha256Hex(input.userAgent) : null,
    },
  });
}
