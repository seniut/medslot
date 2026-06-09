import { z } from "zod";

// Server-side validation for the CSV visit export. The doctor picks an
// inclusive clinic-local date range; the export module converts it to absolute
// UTC bounds. Error messages are stable codes (translated in the UI / returned
// by the export route).

export const exportRangeSchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalidDate"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalidDate"),
  })
  .refine((value) => value.from <= value.to, {
    message: "invalidRange",
    path: ["to"],
  });

export type ExportRangeInput = z.infer<typeof exportRangeSchema>;
