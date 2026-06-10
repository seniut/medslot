import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminLoginForm } from "@/components/admin/login-form";
import { MedSlotLogo } from "@/components/medslot-logo";
import { redirect } from "@/i18n/navigation";
import { getAdminSession } from "@/server/auth/getAdminSession";

// Reads the session cookie at request time; never prerender.
export const dynamic = "force-dynamic";

type AdminLoginPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminLoginPage({ params }: AdminLoginPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getAdminSession();
  if (session) {
    redirect({ href: "/admin/calendar", locale });
  }

  const t = await getTranslations("admin.login");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MedSlotLogo className="h-8 w-8" title="" />
          <span className="text-lg font-semibold tracking-tight text-teal-700">
            MedSlot
          </span>
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
      </div>
      <AdminLoginForm locale={locale} />
    </main>
  );
}
