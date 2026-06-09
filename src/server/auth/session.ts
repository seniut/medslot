import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

// Stateless, signed admin session cookie. The cookie carries only the admin
// user id and an expiry, signed with HMAC-SHA256 using AUTH_SECRET, so it
// cannot be forged. Authorization data (clinic, role) is re-loaded from the
// database on every request (see getAdminSession), never trusted from the
// cookie. See DECISIONS.md (Decision 009).

export const ADMIN_SESSION_COOKIE = "medslot_admin_session";

/** Session lifetime in milliseconds (12 hours). */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

type SessionPayload = {
  /** Admin user id. */
  sub: string;
  /** Expiry as epoch milliseconds. */
  exp: number;
};

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set; admin sessions cannot be signed.");
  }
  return secret;
}

function sign(body: string): string {
  return createHmac("sha256", getSecret()).update(body).digest("base64url");
}

/** Encode and sign a session payload into a cookie value. */
function serialize(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${body}.${sign(body)}`;
}

/** Verify a cookie value and return its payload, or null if invalid/expired. */
function deserialize(value: string): SessionPayload | null {
  const dot = value.indexOf(".");
  if (dot <= 0) {
    return null;
  }
  const body = value.slice(0, dot);
  const signature = value.slice(dot + 1);

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as SessionPayload).sub !== "string" ||
      typeof (parsed as SessionPayload).exp !== "number"
    ) {
      return null;
    }
    const payload = parsed as SessionPayload;
    if (payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/** Issue a signed session cookie for the given admin user id. */
export async function setAdminSessionCookie(adminUserId: string): Promise<void> {
  const value = serialize({ sub: adminUserId, exp: Date.now() + SESSION_TTL_MS });
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

/** Clear the admin session cookie (logout). */
export async function clearAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_SESSION_COOKIE);
}

/** Read and verify the current session cookie; returns the admin user id or null. */
export async function readAdminUserIdFromCookie(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!value) {
    return null;
  }
  const payload = deserialize(value);
  return payload?.sub ?? null;
}
