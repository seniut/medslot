import { describe, expect, it, vi } from "vitest";

import {
  OverrideRecipientAdapter,
  redirectMessage,
  type EmailAdapter,
  type EmailMessage,
} from "@/server/email/adapter";

const baseMessage: EmailMessage = {
  to: "patient@example.com",
  subject: "Appointment confirmation",
  text: "body",
  html: "<p>body</p>",
};

describe("redirectMessage", () => {
  it("rewrites the recipient and keeps the original in the subject", () => {
    const result = redirectMessage(baseMessage, "ops@example.com");

    expect(result.to).toBe("ops@example.com");
    expect(result.subject).toBe(
      "[→ patient@example.com] Appointment confirmation",
    );
  });

  it("preserves the text and html bodies unchanged", () => {
    const result = redirectMessage(baseMessage, "ops@example.com");

    expect(result.text).toBe(baseMessage.text);
    expect(result.html).toBe(baseMessage.html);
  });
});

describe("OverrideRecipientAdapter", () => {
  it("forwards every message to the override address via the inner adapter", async () => {
    const send = vi.fn<(message: EmailMessage) => Promise<void>>(
      async () => undefined,
    );
    const inner: EmailAdapter = { send };

    const adapter = new OverrideRecipientAdapter(inner, "ops@example.com");
    await adapter.send(baseMessage);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ops@example.com",
        subject: "[→ patient@example.com] Appointment confirmation",
        text: "body",
        html: "<p>body</p>",
      }),
    );
  });
});
