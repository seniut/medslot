import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Supported locales. Polish is the default for the first target market.
  locales: ["pl", "en"],
  defaultLocale: "pl",
});

export type Locale = (typeof routing.locales)[number];
