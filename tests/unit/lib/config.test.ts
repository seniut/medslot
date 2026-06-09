import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BOOKING_DEFAULTS,
  CONSENT_TYPE_BOOKING,
  PRIVACY_TEXT_VERSION,
} from "@/lib/booking-config";
import { cn } from "@/lib/utils";

describe("booking-config", () => {
  it("exposes the MVP slot defaults", () => {
    expect(BOOKING_DEFAULTS.durationMinutes).toBe(60);
    expect(BOOKING_DEFAULTS.slotStepMinutes).toBe(30);
    expect(BOOKING_DEFAULTS.minNoticeHours).toBe(4);
    expect(BOOKING_DEFAULTS.bookingWindowDays).toBe(30);
    expect(BOOKING_DEFAULTS.fallbackTimeZone).toBe("Europe/Warsaw");
  });

  it("has a dated privacy text version and booking consent type", () => {
    expect(PRIVACY_TEXT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(CONSENT_TYPE_BOOKING).toBe("booking_privacy");
  });
});

describe("cn", () => {
  it("merges class names and drops falsy values", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });

  it("lets later Tailwind utilities win", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

describe("retention-config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to 24 months when RETENTION_MONTHS is unset", async () => {
    vi.resetModules();
    vi.stubEnv("RETENTION_MONTHS", "");
    const mod = await import("@/lib/retention-config");
    expect(mod.RETENTION_DEFAULTS.retentionMonths).toBe(24);
    expect(mod.ANONYMIZED_PATIENT).toEqual({
      firstName: "Anonymized",
      lastName: "Patient",
      phone: "",
      email: "",
    });
  });

  it("reads a positive integer from the environment", async () => {
    vi.resetModules();
    vi.stubEnv("RETENTION_MONTHS", "12");
    const mod = await import("@/lib/retention-config");
    expect(mod.RETENTION_DEFAULTS.retentionMonths).toBe(12);
  });

  it("falls back to 24 for non-positive or invalid values", async () => {
    vi.resetModules();
    vi.stubEnv("RETENTION_MONTHS", "-5");
    const negative = await import("@/lib/retention-config");
    expect(negative.RETENTION_DEFAULTS.retentionMonths).toBe(24);

    vi.resetModules();
    vi.stubEnv("RETENTION_MONTHS", "abc");
    const invalid = await import("@/lib/retention-config");
    expect(invalid.RETENTION_DEFAULTS.retentionMonths).toBe(24);
  });
});
