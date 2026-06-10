import type { Prisma } from "@prisma/client";

import { prisma } from "@/db/prisma";

export type AuditAction =
  | "appointment.created_public"
  | "appointment.created_manual"
  | "appointment.cancelled_by_patient"
  | "appointment.cancelled_by_doctor"
  | "appointment.rescheduled"
  | "appointment.completed"
  | "appointment.no_show"
  | "note.created"
  | "note.updated"
  | "export.appointments_csv"
  | "working_hours.updated"
  | "blocked_time.created"
  | "blocked_time.deleted"
  | "patient.exported"
  | "patient.anonymized"
  | "retention.anonymized";

export type AuditActorType = "patient" | "doctor" | "system";

export type LogAuditEventInput = {
  clinicId: string;
  actorType: AuditActorType;
  actorUserId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  /** Non-sensitive metadata only — never note content or patient PII. */
  metadata?: Prisma.InputJsonValue;
};

/**
 * Append an audit log entry. Accepts a transaction client so audit writes can
 * be atomic with the action they describe; falls back to the shared client.
 *
 * Do not pass sensitive data (note text, phone, email, raw tokens) in metadata.
 */
export async function logAuditEvent(
  input: LogAuditEventInput,
  client: Prisma.TransactionClient = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      clinicId: input.clinicId,
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
    },
  });
}
