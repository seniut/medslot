import { use } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export default function HomePage({ params }: HomePageProps) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("home");
  const tCommon = useTranslations("common");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm font-medium">
          MedSlot
        </span>
        <LocaleSwitcher />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground text-lg">{t("tagline")}</p>
      <p className="text-muted-foreground text-sm">{t("description")}</p>
      <div>
        <Button asChild>
          <Link href="/booking">{t("bookCta")}</Link>
        </Button>
      </div>
      <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
        {t("bootstrapNotice")}
      </p>
      <p className="text-muted-foreground text-sm">
        <Link href="/privacy" className="underline">
          {tCommon("privacyPolicy")}
        </Link>
      </p>
    </main>
  );
}
