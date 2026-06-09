import { setRequestLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";

type AdminIndexPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminIndexPage({ params }: AdminIndexPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The calendar lives under the auth-guarded layout, which redirects to login
  // when there is no session.
  redirect({ href: "/admin/calendar", locale });
}
