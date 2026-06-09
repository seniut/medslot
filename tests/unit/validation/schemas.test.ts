import { describe, expect, it } from "vitest";

import { bookingSchema } from "@/lib/validation/bookingSchema";
import { manualAppointmentSchema } from "@/lib/validation/manualAppointmentSchema";
import { blockedTimeSchema } from "@/lib/validation/blockedTimeSchema";
import { exportRangeSchema } from "@/lib/validation/exportSchema";
import { noteSchema } from "@/lib/validation/noteSchema";
import { anonymizePatientSchema } from "@/lib/validation/patientSchema";
import { cancellationSchema } from "@/lib/validation/cancellationSchema";
import { loginSchema } from "@/lib/validation/adminAuthSchema";

import { codeForPath, errorCodes } from "../_support/zod";

function validBooking(overrides: Record<string, unknown> = {}) {
  return {
    locale: "pl",
    startsAt: "2026-06-10T09:00:00.000Z",
    endsAt: "2026-06-10T10:00:00.000Z",
    firstName: "Jan",
    lastName: "Kowalski",
    phone: "+48600700800",
    email: "jan@example.com",
    message: "",
    consent: true,
    ...overrides,
  };
}

describe("bookingSchema", () => {
  it("accepts a valid booking", () => {
    expect(bookingSchema.safeParse(validBooking()).success).toBe(true);
  });

  it("requires consent to be exactly true", () => {
    const result = bookingSchema.safeParse(validBooking({ consent: false }));
    expect(codeForPath(result, "consent")).toBe("consentRequired");
  });

  it("rejects an invalid email", () => {
    const result = bookingSchema.safeParse(validBooking({ email: "not-an-email" }));
    expect(codeForPath(result, "email")).toBe("invalidEmail");
  });

  it("rejects an empty first name as required", () => {
    const result = bookingSchema.safeParse(validBooking({ firstName: "  " }));
    expect(codeForPath(result, "firstName")).toBe("required");
  });

  it("rejects an over-long last name", () => {
    const result = bookingSchema.safeParse(validBooking({ lastName: "x".repeat(101) }));
    expect(codeForPath(result, "lastName")).toBe("tooLong");
  });

  it("rejects a too-short phone", () => {
    const result = bookingSchema.safeParse(validBooking({ phone: "12" }));
    expect(codeForPath(result, "phone")).toBe("required");
  });

  it("rejects an unparseable startsAt", () => {
    const result = bookingSchema.safeParse(validBooking({ startsAt: "nope" }));
    expect(codeForPath(result, "startsAt")).toBe("invalidSlot");
  });

  it("rejects an unsupported locale", () => {
    const result = bookingSchema.safeParse(validBooking({ locale: "de" }));
    expect(result.success).toBe(false);
  });

  it("allows an omitted optional message", () => {
    const input = validBooking();
    delete (input as Record<string, unknown>).message;
    expect(bookingSchema.safeParse(input).success).toBe(true);
  });
});

describe("manualAppointmentSchema", () => {
  function valid(overrides: Record<string, unknown> = {}) {
    return {
      locale: "en",
      date: "2026-06-10",
      time: "09:30",
      firstName: "Anna",
      lastName: "Nowak",
      phone: "+48600700800",
      ...overrides,
    };
  }

  it("accepts a valid manual appointment without email", () => {
    expect(manualAppointmentSchema.safeParse(valid()).success).toBe(true);
  });

  it("accepts an optional valid email", () => {
    expect(manualAppointmentSchema.safeParse(valid({ email: "a@b.com" })).success).toBe(true);
  });

  it("rejects a bad date format", () => {
    const result = manualAppointmentSchema.safeParse(valid({ date: "10-06-2026" }));
    expect(codeForPath(result, "date")).toBe("invalidDate");
  });

  it("rejects a bad time format", () => {
    const result = manualAppointmentSchema.safeParse(valid({ time: "9:30" }));
    expect(codeForPath(result, "time")).toBe("invalidTime");
  });

  it("rejects an invalid optional email", () => {
    const result = manualAppointmentSchema.safeParse(valid({ email: "bad" }));
    expect(codeForPath(result, "email")).toBe("invalidEmail");
  });
});

describe("blockedTimeSchema", () => {
  function valid(overrides: Record<string, unknown> = {}) {
    return {
      locale: "pl",
      date: "2026-06-10",
      startTime: "12:00",
      endTime: "13:00",
      ...overrides,
    };
  }

  it("accepts a valid interval", () => {
    expect(blockedTimeSchema.safeParse(valid()).success).toBe(true);
  });

  it("rejects end before or equal to start", () => {
    const result = blockedTimeSchema.safeParse(valid({ endTime: "12:00" }));
    expect(codeForPath(result, "endTime")).toBe("endBeforeStart");
  });

  it("rejects a malformed date", () => {
    const result = blockedTimeSchema.safeParse(valid({ date: "2026/06/10" }));
    expect(codeForPath(result, "date")).toBe("invalidDate");
  });

  it("rejects an over-long reason", () => {
    const result = blockedTimeSchema.safeParse(valid({ reason: "x".repeat(201) }));
    expect(codeForPath(result, "reason")).toBe("tooLong");
  });
});

describe("exportRangeSchema", () => {
  it("accepts an inclusive range and equal endpoints", () => {
    expect(exportRangeSchema.safeParse({ from: "2026-06-01", to: "2026-06-30" }).success).toBe(true);
    expect(exportRangeSchema.safeParse({ from: "2026-06-01", to: "2026-06-01" }).success).toBe(true);
  });

  it("rejects from after to", () => {
    const result = exportRangeSchema.safeParse({ from: "2026-06-30", to: "2026-06-01" });
    expect(codeForPath(result, "to")).toBe("invalidRange");
  });

  it("rejects a malformed date", () => {
    const result = exportRangeSchema.safeParse({ from: "June 1", to: "2026-06-30" });
    expect(codeForPath(result, "from")).toBe("invalidDate");
  });
});

describe("noteSchema", () => {
  function valid(overrides: Record<string, unknown> = {}) {
    return { locale: "pl", patientId: "p1", content: "Patient tolerated session well.", ...overrides };
  }

  it("accepts a valid note", () => {
    expect(noteSchema.safeParse(valid()).success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = noteSchema.safeParse(valid({ content: "   " }));
    expect(codeForPath(result, "content")).toBe("required");
  });

  it("rejects over-long content", () => {
    const result = noteSchema.safeParse(valid({ content: "x".repeat(5001) }));
    expect(codeForPath(result, "content")).toBe("tooLong");
  });

  it("rejects a missing patient id", () => {
    const result = noteSchema.safeParse(valid({ patientId: "" }));
    expect(codeForPath(result, "patientId")).toBe("required");
  });
});

describe("anonymizePatientSchema", () => {
  it("accepts a ticked confirmation", () => {
    expect(
      anonymizePatientSchema.safeParse({ locale: "pl", patientId: "p1", confirm: "on" }).success,
    ).toBe(true);
  });

  it("requires the confirmation literal", () => {
    const result = anonymizePatientSchema.safeParse({ locale: "pl", patientId: "p1", confirm: "off" });
    expect(codeForPath(result, "confirm")).toBe("confirmRequired");
  });

  it("requires a patient id", () => {
    const result = anonymizePatientSchema.safeParse({ locale: "pl", patientId: "", confirm: "on" });
    expect(codeForPath(result, "patientId")).toBe("required");
  });
});

describe("cancellationSchema", () => {
  it("accepts a plausible token", () => {
    expect(cancellationSchema.safeParse({ locale: "pl", token: "a".repeat(43) }).success).toBe(true);
  });

  it("rejects a too-short token", () => {
    const result = cancellationSchema.safeParse({ locale: "pl", token: "short" });
    expect(codeForPath(result, "token")).toBe("invalidToken");
  });

  it("rejects a too-long token", () => {
    const result = cancellationSchema.safeParse({ locale: "pl", token: "a".repeat(257) });
    expect(codeForPath(result, "token")).toBe("invalidToken");
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    expect(
      loginSchema.safeParse({ locale: "pl", email: "admin@example.com", password: "secret" }).success,
    ).toBe(true);
  });

  it("collapses an invalid email to invalidCredentials", () => {
    const result = loginSchema.safeParse({ locale: "pl", email: "nope", password: "secret" });
    expect(errorCodes(result)).toContain("invalidCredentials");
  });

  it("collapses an empty password to invalidCredentials", () => {
    const result = loginSchema.safeParse({ locale: "pl", email: "admin@example.com", password: "" });
    expect(errorCodes(result)).toContain("invalidCredentials");
  });
});
