import { BOOKING_DEFAULTS } from "@/lib/booking-config";
import { exportRangeSchema } from "@/lib/validation/exportSchema";
import { getBookingContext } from "@/server/appointments/getBookingContext";
import { getAdminSession } from "@/server/auth/getAdminSession";
import { exportAppointmentsForRange } from "@/server/export/exportAppointments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Download a CSV of clinic visits for an inclusive date range.
 *
 * Lives under /api (outside the locale middleware) and authenticates via the
 * admin session cookie. Unauthenticated requests are redirected to login. The
 * range is validated server-side; the export itself is clinic-scoped and
 * audited inside `exportAppointmentsForRange`.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await getAdminSession();
  if (!session) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/admin/login" },
    });
  }

  const url = new URL(request.url);
  const parsed = exportRangeSchema.safeParse({
    from: url.searchParams.get("from") ?? "",
    to: url.searchParams.get("to") ?? "",
  });
  if (!parsed.success) {
    return new Response("Invalid date range", { status: 400 });
  }

  const context = await getBookingContext();
  const timeZone =
    context && context.clinicId === session.clinicId
      ? context.timeZone
      : BOOKING_DEFAULTS.fallbackTimeZone;

  const { csv } = await exportAppointmentsForRange(session, {
    from: parsed.data.from,
    to: parsed.data.to,
    timeZone,
  });

  // Prepend a UTF-8 BOM so spreadsheet apps detect the encoding correctly.
  const body = `\uFEFF${csv}`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="medslot-visits_${parsed.data.from}_${parsed.data.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
