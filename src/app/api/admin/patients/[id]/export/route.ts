import { getAdminSession } from "@/server/auth/getAdminSession";
import { exportPatientData } from "@/server/patients/exportPatientData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Download a single patient's full record as JSON (GDPR/RODO access /
 * portability).
 *
 * Lives under /api (outside the locale middleware) and authenticates via the
 * admin session cookie. The export is clinic-scoped and audited inside
 * `exportPatientData`; a patient from another clinic is treated as not found.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getAdminSession();
  if (!session) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/admin/login" },
    });
  }

  const { id } = await params;
  const result = await exportPatientData({
    clinicId: session.clinicId,
    patientId: id,
    actorUserId: session.adminUserId,
  });
  if (!result) {
    return new Response("Patient not found", { status: 404 });
  }

  return new Response(JSON.stringify(result.data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
