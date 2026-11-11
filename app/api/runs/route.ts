/** GET /api/runs?limit=100 — лог запусков и итоги для мониторинга */
import { getMonitoringData } from "@/lib/db/monitoring";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 100);
  try {
    const data = await getMonitoringData(limit);
    if (!data) return Response.json({ error: "DATABASE_URL is not set" }, { status: 503 });
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[runs]", error);
    return Response.json({ error: "Failed to read runs" }, { status: 500 });
  }
}
