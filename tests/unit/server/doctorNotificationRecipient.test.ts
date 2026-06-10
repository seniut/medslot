import { describe, expect, it } from "vitest";

import { resolveDoctorNotificationRecipient } from "@/server/email/sendDoctorNewBookingEmail";

describe("resolveDoctorNotificationRecipient", () => {
  it("prefers the DOCTOR_NOTIFICATION_EMAIL override when set", () => {
    expect(
      resolveDoctorNotificationRecipient(
        "doctor@clinic.example",
        "frontdesk@clinic.example",
      ),
    ).toBe("frontdesk@clinic.example");
  });

  it("trims the override before using it", () => {
    expect(
      resolveDoctorNotificationRecipient(
        "doctor@clinic.example",
        "  frontdesk@clinic.example  ",
      ),
    ).toBe("frontdesk@clinic.example");
  });

  it("falls back to the doctor email when the override is unset", () => {
    expect(
      resolveDoctorNotificationRecipient("doctor@clinic.example", ""),
    ).toBe("doctor@clinic.example");
  });

  it("falls back to the doctor email when the override is blank", () => {
    expect(
      resolveDoctorNotificationRecipient("doctor@clinic.example", "   "),
    ).toBe("doctor@clinic.example");
  });

  it("returns null when neither a usable override nor doctor email exists", () => {
    expect(resolveDoctorNotificationRecipient("", "")).toBeNull();
    expect(resolveDoctorNotificationRecipient("   ", "   ")).toBeNull();
  });
});
