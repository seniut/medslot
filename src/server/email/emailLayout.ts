// Shared HTML layout for transactional emails.
//
// Wraps the plain text lines each sender already builds in a lightweight,
// email-client-friendly shell with the MedSlot brand header (logo + wordmark).
// The logo is a hosted PNG referenced by absolute URL because most email
// clients (Gmail, etc.) block inline SVG and data URIs; when images are
// disabled the teal "MedSlot" wordmark still shows, so the brand is never lost.
//
// The plain-text alternative is built by the senders themselves and is left
// untouched (text emails cannot carry a logo).

const BRAND_NAME = "MedSlot";
const BRAND_TEAL = "#0f766e";
const LOGO_PATH = "/medslot-email-logo.png";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function renderBody(lines: string[]): string {
  return lines
    .map((line) =>
      line === ""
        ? "<br/>"
        : `<p style="margin:0 0 12px;">${escapeHtml(line)}</p>`,
    )
    .join("");
}

function renderHeader(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  const logo = appUrl
    ? `<img src="${appUrl}${LOGO_PATH}" width="36" height="36" alt="" ` +
      `style="display:inline-block;vertical-align:middle;border:0;border-radius:9px;" />`
    : "";
  return (
    `<div style="padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid #e5e7eb;">` +
    `${logo}` +
    `<span style="display:inline-block;vertical-align:middle;margin-left:${logo ? "10px" : "0"};` +
    `font-size:18px;font-weight:600;color:${BRAND_TEAL};">${BRAND_NAME}</span>` +
    `</div>`
  );
}

/**
 * Render the branded HTML body for a transactional email from its text lines.
 */
export function renderBrandedEmailHtml(lines: string[]): string {
  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;` +
    `line-height:1.6;color:#0f172a;max-width:560px;margin:0 auto;padding:24px;">` +
    `${renderHeader()}` +
    `${renderBody(lines)}` +
    `</div>`
  );
}
