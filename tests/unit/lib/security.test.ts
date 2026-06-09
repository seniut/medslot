import { describe, expect, it } from "vitest";

import { sha256Hex } from "@/lib/security/hashing";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { generateCancellationToken } from "@/lib/security/tokens";

describe("sha256Hex", () => {
  it("matches known SHA-256 digests", () => {
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("is deterministic", () => {
    expect(sha256Hex("medslot")).toBe(sha256Hex("medslot"));
  });
});

describe("generateCancellationToken", () => {
  it("returns a raw token and its SHA-256 hash", () => {
    const { token, tokenHash } = generateCancellationToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).toBe(sha256Hex(token));
  });

  it("produces unique tokens", () => {
    const a = generateCancellationToken();
    const b = generateCancellationToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe("password hashing", () => {
  it("stores a self-describing scrypt hash and verifies the right password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("s3cret");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("returns false for malformed stored values instead of throwing", async () => {
    expect(await verifyPassword("x", "not-a-valid-hash")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });

  it("uses a random salt so identical passwords hash differently", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same", a)).toBe(true);
    expect(await verifyPassword("same", b)).toBe(true);
  });
});
