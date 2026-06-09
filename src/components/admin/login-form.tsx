"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  initialLoginFormState,
  type LoginFormState,
} from "@/lib/validation/adminAuthSchema";
import { loginAction } from "@/server/auth/authActions";

type AdminLoginFormProps = {
  locale: string;
};

export function AdminLoginForm({ locale }: AdminLoginFormProps) {
  const t = useTranslations("admin.login");
  const [state, formAction, isPending] = useActionState<
    LoginFormState,
    FormData
  >(loginAction, initialLoginFormState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          {t("email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="border-input w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          {t("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="border-input w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {t(state.error)}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
