import { describe, expect, it } from "vitest";

import { isNoOverlapViolation } from "@/server/appointments/overlap";

describe("isNoOverlapViolation", () => {
  it("detects the constraint name in an error message", () => {
    expect(
      isNoOverlapViolation(new Error('conflicting key value violates constraint "appointment_no_overlap"')),
    ).toBe(true);
  });

  it("detects the SQLSTATE exclusion-violation code 23P01", () => {
    expect(isNoOverlapViolation(new Error("error 23P01: exclusion"))).toBe(true);
  });

  it("detects a generic exclusion-constraint message", () => {
    expect(isNoOverlapViolation(new Error("violates exclusion constraint"))).toBe(true);
  });

  it("detects the constraint name from a non-Error value", () => {
    expect(isNoOverlapViolation("appointment_no_overlap")).toBe(true);
  });

  it("is false for unrelated errors and nullish values", () => {
    expect(isNoOverlapViolation(new Error("some other failure"))).toBe(false);
    expect(isNoOverlapViolation(null)).toBe(false);
    expect(isNoOverlapViolation(undefined)).toBe(false);
  });
});
