// Email adapter abstraction.
//
// The provider is selected by the EMAIL_PROVIDER env var:
// - "log"  (default): logs only, sends nothing. Safe for local dev and trials.
// - "smtp": sends via any SMTP server (e.g. Gmail) using nodemailer.
// - "resend": reserved for later (requires a verified sending domain).
//
// Privacy: adapters must never log recipients, subjects, bodies, or links —
// cancellation links contain a one-time token.

import nodemailer, { type Transporter } from "nodemailer";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface EmailAdapter {
  send(message: EmailMessage): Promise<void>;
}

class LogEmailAdapter implements EmailAdapter {
  async send(): Promise<void> {
    // Intentionally logs no message contents (no PII, no token-bearing links).
    console.info("[email] message dispatched (log adapter)");
  }
}

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
};

class SmtpEmailAdapter implements EmailAdapter {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      // Port 465 uses implicit TLS; other ports (e.g. 587) upgrade via STARTTLS.
      secure: config.port === 465,
      auth: { user: config.user, pass: config.password },
    });
    this.from = config.from;
  }

  async send(message: EmailMessage): Promise<void> {
    // Errors propagate to the caller, which logs only a generic, PII-free
    // message; nothing sensitive is logged here.
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}

function readSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM?.trim();
  if (!host || !user || !password || !from) {
    return null;
  }
  const parsedPort = Number.parseInt(process.env.SMTP_PORT ?? "465", 10);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 465;
  return { host, port, user, password, from };
}

function createEmailAdapter(): EmailAdapter {
  const provider = (process.env.EMAIL_PROVIDER ?? "log").trim().toLowerCase();

  if (provider === "smtp") {
    const config = readSmtpConfig();
    if (config) {
      return new SmtpEmailAdapter(config);
    }
    // Misconfigured: never crash a booking — fall back to the log adapter.
    console.warn(
      "[email] EMAIL_PROVIDER=smtp but SMTP settings are incomplete; using log adapter",
    );
    return new LogEmailAdapter();
  }

  if (provider !== "log") {
    console.warn(`[email] unknown EMAIL_PROVIDER "${provider}"; using log adapter`);
  }
  return new LogEmailAdapter();
}

let cachedAdapter: EmailAdapter | null = null;

/** Return the configured email adapter (selected by EMAIL_PROVIDER). */
export function getEmailAdapter(): EmailAdapter {
  if (!cachedAdapter) {
    cachedAdapter = createEmailAdapter();
  }
  return cachedAdapter;
}
