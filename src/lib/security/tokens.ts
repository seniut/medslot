import { randomBytes } from "node:crypto";

import { sha256Hex } from "@/lib/security/hashing";

export type CancellationToken = {
  /** Raw token — included only in the cancellation link sent to the patient. */
  token: string;
  /** SHA-256 hash of the token — the only value persisted in the database. */
  tokenHash: string;
};

/**
 * Generate a secure random cancellation token and its hash.
 *
 * The raw token is returned for one-time use in the confirmation email link.
 * Only the hash is stored (see Appointment.cancelTokenHash), so the database
 * never holds a usable token. Never log the raw token.
 */
export function generateCancellationToken(): CancellationToken {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: sha256Hex(token) };
}
