import { getTranslations } from "next-intl/server";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { logoutAction } from "@/server/auth/authActions";

type AdminNavProps = {
  locale: string;
  email: string;
};

export async function AdminNav({ locale, email }: AdminNavProps) {
  const t = await getTranslations("admin.nav");

  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold">{t("brand")}</span>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="/admin/calendar"
              className="hover:text-foreground text-muted-foreground"
            >
              {t("calendar")}
            </Link>
            <Link
              href="/admin/appointments/new"
              className="hover:text-foreground text-muted-foreground"
            >
              {t("newAppointment")}
            </Link>
            <Link
              href="/admin/patients"
              className="hover:text-foreground text-muted-foreground"
            >
              {t("patients")}
            </Link>
            <Link
              href="/admin/settings"
              className="hover:text-foreground text-muted-foreground"
            >
              {t("settings")}
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground hidden text-xs sm:inline">
            {t("signedInAs", { email })}
          </span>
          <LocaleSwitcher />
          <form action={logoutAction}>
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" variant="outline" size="sm">
              {t("logout")}
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
