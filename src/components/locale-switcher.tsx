"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-2 text-sm">
      {routing.locales.map((target) => (
        <button
          key={target}
          type="button"
          aria-current={target === locale ? "true" : undefined}
          onClick={() => router.replace(pathname, { locale: target })}
          className={cn(
            "hover:text-foreground uppercase transition-colors",
            target === locale
              ? "text-foreground font-semibold"
              : "text-muted-foreground",
          )}
        >
          {target}
        </button>
      ))}
    </div>
  );
}
