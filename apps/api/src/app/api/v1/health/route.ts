import { getHealthResponse } from "@/server/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getHealthResponse(), {
    headers: { "Cache-Control": "no-store" },
  });
}
