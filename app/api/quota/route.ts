/** GET /api/quota — сколько бесплатных запусков модели осталось у этого клиента */
import { getQuota } from "@/lib/db/quota";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const quota = await getQuota(request.headers);
  return Response.json(quota ?? { limit: null }, { headers: { "Cache-Control": "no-store" } });
}
