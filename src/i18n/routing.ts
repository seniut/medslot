import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Supported locales. Polish is the default for the first target market.
  locales: ["pl", "en"],
  defaultLocale: "pl",
  // Always land on the default locale (Polish) instead of guessing from the
  // browser's Accept-Language header, so visitors see the Polish UI first and
  // can switch to English via the language switcher.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
