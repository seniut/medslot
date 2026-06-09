import { getTranslations, setRequestLocale } from "next-intl/server";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { PRIVACY_TEXT_VERSION } from "@/lib/booking-config";

type PrivacyPageProps = {
  params: Promise<{ locale: string }>;
};

// Section order is fixed here; each key maps to a title/body pair in the
// `privacy` i18n namespace. This is a public, patient-facing page and must
// never render real patient data.
const SECTION_KEYS = [
  "controller",
  "dataProcessed",
  "purpose",
  "legalBasis",
  "recipients",
  "retention",
  "rights",
  "voluntary",
  "security",
] as const;

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ‹ {t("backHome")}
        </Link>
        <LocaleSwitcher />
      </div>

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("lastUpdated", { version: PRIVACY_TEXT_VERSION })}
        </p>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>

      <div className="space-y-6">
        {SECTION_KEYS.map((key) => (
          <section key={key} className="space-y-1">
            <h2 className="text-lg font-semibold">
              {t(`sections.${key}.title`)}
            </h2>
            <p className="text-muted-foreground text-sm whitespace-pre-line">
              {t(`sections.${key}.body`)}
            </p>
          </section>
        ))}
      </div>

      <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
        {t("contactNotice")}
      </p>

      <div>
        <Button asChild>
          <Link href="/booking">{t("bookCta")}</Link>
        </Button>
      </div>
    </main>
  );
}
