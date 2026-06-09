import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Password hashing for admin users using scrypt from the Node.js standard
// library (no extra dependency). Stored format: `scrypt$<saltB64>$<hashB64>`.
// Raw passwords are never stored or logged.

const scrypt = promisify(scryptCallback);

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCHEME = "scrypt";

/** Hash a plaintext password into a self-describing, storable string. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = (await scrypt(plain, salt, KEY_LENGTH)) as Buffer;
  return `${SCHEME}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

/**
 * Verify a plaintext password against a stored hash in constant time.
 * Returns false for malformed stored values instead of throwing.
 */
export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== SCHEME || !saltB64 || !hashB64) {
    return false;
  }

  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const derived = (await scrypt(plain, salt, expected.length)) as Buffer;

  return (
    expected.length === derived.length && timingSafeEqual(expected, derived)
  );
}
