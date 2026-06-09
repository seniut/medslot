// Data-retention configuration (GDPR/RODO). See docs/04-gdpr-rodo.md.
//
// These control the optional retention sweep that anonymizes patient contact
// data after a configurable period of inactivity. The values are product
// defaults, not legal rules — the controller must configure them according to
// their legal basis and business need.

function readRetentionMonths(): number {
  const raw = process.env.RETENTION_MONTHS;
  if (!raw) {
    return 24;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 24;
  }
  return parsed;
}

export const RETENTION_DEFAULTS = {
  /**
   * Months of inactivity (measured from a patient's most recent appointment)
   * after which the retention sweep may anonymize their contact data. Patients
   * with any future appointment are always excluded. Default 24 months.
   */
  retentionMonths: readRetentionMonths(),
} as const;

/**
 * Neutral, non-identifying placeholders written over a patient's contact
 * fields when they are anonymized. They are deliberately locale-independent
 * (stored data, not UI) and carry no personal data.
 */
export const ANONYMIZED_PATIENT = {
  firstName: "Anonymized",
  lastName: "Patient",
  phone: "",
  email: "",
} as const;
