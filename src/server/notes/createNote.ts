import { prisma } from "@/db/prisma";
import type { NoteInput } from "@/lib/validation/noteSchema";
import { getBookingContext } from "@/server/appointments/getBookingContext";
import { logAuditEvent } from "@/server/audit/logAuditEvent";
import type { AdminSession } from "@/server/auth/getAdminSession";

/** Thrown when the note's patient/appointment is missing or in another clinic. */
export class NoteTargetNotFoundError extends Error {
  constructor() {
    super("Note target not found");
    this.name = "NoteTargetNotFoundError";
  }
}

/**
 * Resolve the doctor a note belongs to. The session may not carry a doctorId
 * (e.g. an owner account), so fall back to the clinic's bookable doctor. The
 * resolved doctor must belong to the admin's clinic.
 */
async function resolveDoctorId(session: AdminSession): Promise<string | null> {
  if (session.doctorId) {
    return session.doctorId;
  }
  const context = await getBookingContext();
  if (!context || context.clinicId !== session.clinicId) {
    return null;
  }
  return context.doctorId;
}

/**
 * Create an internal doctor note for a patient (optionally tied to a specific
 * appointment), strictly clinic-scoped and audited.
 *
 * The patient — and the appointment, when given — are verified to belong to the
 * admin's clinic before writing. Note content is sensitive and is never written
 * to the audit log.
 */
export async function createDoctorNote(
  session: AdminSession,
  input: Pick<NoteInput, "patientId" | "appointmentId" | "content">,
): Promise<{ id: string }> {
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, clinicId: session.clinicId, deletedAt: null },
    select: { id: true },
  });
  if (!patient) {
    throw new NoteTargetNotFoundError();
  }

  if (input.appointmentId) {
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: input.appointmentId,
        clinicId: session.clinicId,
        patientId: input.patientId,
      },
      select: { id: true },
    });
    if (!appointment) {
      throw new NoteTargetNotFoundError();
    }
  }

  const doctorId = await resolveDoctorId(session);
  if (!doctorId) {
    throw new NoteTargetNotFoundError();
  }

  const created = await prisma.$transaction(async (tx) => {
    const note = await tx.doctorNote.create({
      data: {
        clinicId: session.clinicId,
        doctorId,
        patientId: input.patientId,
        appointmentId: input.appointmentId ?? null,
        content: input.content,
      },
      select: { id: true },
    });

    await logAuditEvent(
      {
        clinicId: session.clinicId,
        actorType: "doctor",
        actorUserId: session.adminUserId,
        action: "note.created",
        entityType: "doctor_note",
        entityId: note.id,
        metadata: { hasAppointment: Boolean(input.appointmentId) },
      },
      tx,
    );

    return note;
  });

  return created;
}
