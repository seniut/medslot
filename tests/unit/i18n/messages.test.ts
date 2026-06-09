import { describe, expect, it } from "vitest";

import en from "@/i18n/messages/en.json";
import pl from "@/i18n/messages/pl.json";

/** Collect every leaf key path (e.g. "home.contactPhoneLabel") in a catalog. */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, val]) =>
    keyPaths(val, prefix ? `${prefix}.${key}` : key),
  );
}

describe("i18n message catalogs", () => {
  it("define exactly the same keys in Polish and English", () => {
    const enKeys = keyPaths(en).sort();
    const plKeys = keyPaths(pl).sort();
    expect(plKeys).toEqual(enKeys);
  });

  it("template the landing-page description with a {doctor} placeholder", () => {
    expect(en.home.description).toContain("{doctor}");
    expect(pl.home.description).toContain("{doctor}");
    // The doctor-less fallback must not require the placeholder.
    expect(en.home.descriptionGeneric).not.toContain("{doctor}");
    expect(pl.home.descriptionGeneric).not.toContain("{doctor}");
  });

  it("keep clinic-specific data out of the home namespace (it lives in the database)", () => {
    for (const removed of [
      "brand",
      "title",
      "contactPhone",
      "contactEmail",
      "contactAddress",
    ]) {
      expect(en.home).not.toHaveProperty(removed);
      expect(pl.home).not.toHaveProperty(removed);
    }
  });
});
