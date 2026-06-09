import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

type ExportFormProps = {
  defaultFrom: string;
  defaultTo: string;
};

/**
 * Date-range CSV export form. Submits as a plain GET to the export route
 * handler (under /api, outside the locale middleware), which streams the file
 * back as an attachment so the browser downloads it without leaving the page.
 */
export async function ExportForm({ defaultFrom, defaultTo }: ExportFormProps) {
  const t = await getTranslations("admin.export");

  return (
    <form
      method="get"
      action="/api/admin/export/appointments"
      className="flex flex-wrap items-end gap-3"
    >
      <label className="space-y-1 text-sm">
        <span className="text-muted-foreground">{t("from")}</span>
        <input
          type="date"
          name="from"
          defaultValue={defaultFrom}
          required
          className="border-input block rounded-md border px-3 py-2 text-sm"
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="text-muted-foreground">{t("to")}</span>
        <input
          type="date"
          name="to"
          defaultValue={defaultTo}
          required
          className="border-input block rounded-md border px-3 py-2 text-sm"
        />
      </label>
      <Button type="submit" variant="outline">
        {t("submit")}
      </Button>
    </form>
  );
}
