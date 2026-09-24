import { SessionResponseSchema } from "@finpill/contracts";
import { getServerEnvironment } from "@/server/environment";
import { verifyBearerSession } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseHeaders(origin: string | null, allowed: boolean) {
  const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
  if (origin && allowed) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

export async function OPTIONS(request: Request) {
  const env = getServerEnvironment();
  const origin = request.headers.get("Origin");
  if (!origin || !env.CLIENT_ORIGINS.includes(origin))
    return new Response(null, {
      status: 403,
      headers: responseHeaders(origin, false),
    });
  const headers = responseHeaders(origin, true);
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization");
  return new Response(null, { status: 204, headers });
}

export async function GET(request: Request) {
  const env = getServerEnvironment();
  const origin = request.headers.get("Origin");
  const allowed = !origin || env.CLIENT_ORIGINS.includes(origin);
  const headers = responseHeaders(origin, allowed);
  if (!allowed)
    return Response.json(
      { error: "forbidden_origin" },
      { status: 403, headers },
    );
  const session = await verifyBearerSession(
    request.headers.get("Authorization"),
    env,
    origin,
  );
  if (!session)
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  return Response.json(
    SessionResponseSchema.parse({ userId: session.userId }),
    {
      headers,
    },
  );
}
