import { createHash } from "node:crypto";

/**
 * Compute a hex-encoded SHA-256 digest of the input.
 *
 * Used for cancellation token hashing and optional IP/user-agent hashing so
 * that raw tokens and raw network identifiers are never persisted.
 */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
