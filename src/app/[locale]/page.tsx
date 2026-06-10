import { getTranslations, setRequestLocale } from "next-intl/server";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { MedSlotLogo } from "@/components/medslot-logo";
import { PhoneLink } from "@/components/phone-link";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getClinicProfile } from "@/server/clinic/getClinicProfile";

// The landing page renders the configured clinic profile (name, doctor, and
// public contact details) from the database, so it is rendered per request
// rather than statically prerendered at build time.
export const dynamic = "force-dynamic";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");
  const clinic = await getClinicProfile();

  const clinicName = clinic?.name ?? tCommon("appName");
  const doctorName = clinic?.doctorName ?? null;
  const phone = clinic?.phone ?? null;
  const email = clinic?.email ?? null;
  const address = clinic?.address ?? null;
  const hasContact = Boolean(phone || email || address);

  return (
    <main className="flex w-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight text-teal-700">
          {clinicName}
        </span>
        <LocaleSwitcher />
      </header>

      <section className="to-background bg-linear-to-b from-teal-50">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-16">
          <p className="text-sm font-semibold tracking-wide text-teal-700 uppercase">
            {t("services")}
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {clinicName}
          </h1>
          <p className="text-muted-foreground text-lg">{t("tagline")}</p>
          <p className="text-muted-foreground max-w-xl">
            {doctorName
              ? t("description", { doctor: doctorName })
              : t("descriptionGeneric")}
          </p>
          <div className="pt-2">
            <Button asChild size="lg">
              <Link href="/booking">{t("bookCta")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {hasContact ? (
        <section className="mx-auto w-full max-w-3xl px-6 py-12">
          <div className="bg-card rounded-xl border p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{t("contactTitle")}</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
              {phone ? (
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">
                    {t("contactPhoneLabel")}
                  </dt>
                  <dd>
                    <PhoneLink
                      phone={phone}
                      className="font-medium text-teal-700 hover:underline"
                    />
                  </dd>
                </div>
              ) : null}
              {email ? (
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">
                    {t("contactEmailLabel")}
                  </dt>
                  <dd>
                    <a
                      href={`mailto:${email}`}
                      className="font-medium text-teal-700 hover:underline"
                    >
                      {email}
                    </a>
                  </dd>
                </div>
              ) : null}
              {address ? (
                <div className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">
                    {t("contactAddressLabel")}
                  </dt>
                  <dd>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${clinicName}, ${address}`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-teal-700 hover:underline"
                    >
                      {address}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>
      ) : null}

      <footer className="mx-auto mt-auto flex w-full max-w-3xl flex-col gap-2 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/privacy"
          className="text-muted-foreground text-sm underline"
        >
          {tCommon("privacyPolicy")}
        </Link>
        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
          <MedSlotLogo className="h-4 w-4" title="" />
          {t("poweredBy")}
        </span>
      </footer>
    </main>
  );
}
