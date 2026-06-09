"use server";

import { revalidatePath } from "next/cache";

import { redirect } from "@/i18n/navigation";
import {
  anonymizePatientSchema,
  type AnonymizeFormState,
} from "@/lib/validation/patientSchema";
import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/getAdminSession";

import {
  AlreadyAnonymizedError,
  PatientHasFutureAppointmentsError,
  PatientNotFoundError,
  anonymizePatient,
} from "./anonymizePatient";

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

/** Anonymize a patient's personal data on request (GDPR/RODO erasure). */
export async function anonymizePatientAction(
  _previousState: AnonymizeFormState,
  formData: FormData,
): Promise<AnonymizeFormState> {
  const parsed = anonymizePatientSchema.safeParse({
    locale: String(formData.get("locale") ?? ""),
    patientId: String(formData.get("patientId") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const confirmError = flattened.confirm?.[0];
    return { formError: confirmError ?? "unexpected", done: false };
  }

  const locale = parsed.data.locale;
  const session = await requireSessionOrRedirect(locale);

  try {
    await anonymizePatient({
      clinicId: session.clinicId,
      patientId: parsed.data.patientId,
      reason: "manual",
      actorUserId: session.adminUserId,
    });
  } catch (error) {
    if (error instanceof PatientHasFutureAppointmentsError) {
      return { formError: "patientHasFutureAppointments", done: false };
    }
    if (error instanceof AlreadyAnonymizedError) {
      return { formError: "alreadyAnonymized", done: false };
    }
    if (error instanceof PatientNotFoundError) {
      return { formError: "notConfigured", done: false };
    }
    console.error("[admin] failed to anonymize patient");
    return { formError: "unexpected", done: false };
  }

  revalidatePath(`/${locale}/admin/patients/${parsed.data.patientId}`);
  revalidatePath(`/${locale}/admin/patients`);
  return { formError: null, done: true };
}
