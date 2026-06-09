"use server";

import { revalidatePath } from "next/cache";

import { redirect } from "@/i18n/navigation";
import {
  noteSchema,
  type NoteFieldErrors,
  type NoteFormState,
} from "@/lib/validation/noteSchema";
import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/getAdminSession";

import { createDoctorNote, NoteTargetNotFoundError } from "./createNote";

type LocaleValue = "pl" | "en";

async function requireSessionOrRedirect(
  locale: LocaleValue,
): Promise<AdminSession> {
  const session = await getAdminSession();
  if (session) {
    return session;
  }
  return redirect({ href: "/admin/login", locale });
}

/** Add an internal note to a patient (and optionally an appointment). */
export async function createNoteAction(
  _previousState: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const rawAppointmentId = formData.get("appointmentId");
  const parsed = noteSchema.safeParse({
    locale: String(formData.get("locale") ?? ""),
    patientId: String(formData.get("patientId") ?? ""),
    appointmentId:
      typeof rawAppointmentId === "string" && rawAppointmentId.trim().length > 0
        ? rawAppointmentId.trim()
        : undefined,
    content: String(formData.get("content") ?? ""),
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const fieldErrors: NoteFieldErrors = {};
    if (flattened.content && flattened.content.length > 0) {
      fieldErrors.content = flattened.content[0];
    }
    return { fieldErrors, formError: null, saved: false };
  }

  const locale = parsed.data.locale;
  const session = await requireSessionOrRedirect(locale);

  try {
    await createDoctorNote(session, {
      patientId: parsed.data.patientId,
      appointmentId: parsed.data.appointmentId,
      content: parsed.data.content,
    });
  } catch (error) {
    if (error instanceof NoteTargetNotFoundError) {
      return { fieldErrors: {}, formError: "notConfigured", saved: false };
    }
    console.error("[admin] failed to create note");
    return { fieldErrors: {}, formError: "unexpected", saved: false };
  }

  revalidatePath(`/${locale}/admin/patients/${parsed.data.patientId}`);
  if (parsed.data.appointmentId) {
    revalidatePath(`/${locale}/admin/appointments/${parsed.data.appointmentId}`);
  }
  return { fieldErrors: {}, formError: null, saved: true };
}
