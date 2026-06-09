"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  initialNoteFormState,
  type NoteFormState,
} from "@/lib/validation/noteSchema";
import { createNoteAction } from "@/server/notes/noteActions";

type NoteFormProps = {
  locale: string;
  patientId: string;
  /** When set, the note is also linked to this appointment. */
  appointmentId?: string;
};

export function NoteForm({ locale, patientId, appointmentId }: NoteFormProps) {
  const t = useTranslations("admin.notes");
  const tErrors = useTranslations("admin.errors");
  const [state, formAction, isPending] = useActionState<NoteFormState, FormData>(
    createNoteAction,
    initialNoteFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the textarea after a successful save so the next note starts blank.
  useEffect(() => {
    if (state.saved) {
      formRef.current?.reset();
    }
  }, [state.saved]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="patientId" value={patientId} />
      {appointmentId ? (
        <input type="hidden" name="appointmentId" value={appointmentId} />
      ) : null}

      <label htmlFor="note-content" className="text-sm font-medium">
        {t("addTitle")}
      </label>
      <textarea
        id="note-content"
        name="content"
        rows={3}
        required
        className="border-input w-full rounded-md border px-3 py-2 text-sm"
        placeholder={t("placeholder")}
      />
      <p className="text-muted-foreground text-xs">{t("warning")}</p>

      {state.fieldErrors.content ? (
        <p role="alert" className="text-destructive text-sm">
          {tErrors(state.fieldErrors.content)}
        </p>
      ) : null}
      {state.formError ? (
        <p role="alert" className="text-destructive text-sm">
          {tErrors(state.formError)}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-sm font-medium text-green-600">
          {t("saved")}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? t("adding") : t("add")}
      </Button>
    </form>
  );
}
