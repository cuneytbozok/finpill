import { z } from "zod";
import { getServerEnvironment } from "@/server/environment";
import { verifyBearerSession } from "@/server/auth";
import { createUserDatabaseClient } from "@/server/user-database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ProfileInput = z.strictObject({
  displayName: z.string().trim().min(1).max(80),
});

function headersFor(origin: string | null, allowed: boolean) {
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
      headers: headersFor(origin, false),
    });
  const headers = headersFor(origin, true);
  headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  return new Response(null, { status: 204, headers });
}

async function handle(request: Request, method: "GET" | "POST" | "PATCH") {
  const env = getServerEnvironment();
  const origin = request.headers.get("Origin");
  const allowed = !origin || env.CLIENT_ORIGINS.includes(origin);
  const headers = headersFor(origin, allowed);
  if (!allowed)
    return Response.json(
      { error: "forbidden_origin" },
      { status: 403, headers },
    );

  const authorization = request.headers.get("Authorization");
  const session = await verifyBearerSession(authorization, env, origin);
  if (!session || !authorization)
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  if (!env.DATABASE_ENABLED)
    return Response.json({ error: "unavailable" }, { status: 503, headers });

  const db = createUserDatabaseClient(env, authorization.slice(7));
  const eligibility = await db
    .from("pilot_eligibility")
    .select("enabled")
    .eq("user_id", session.userId)
    .maybeSingle();
  if (eligibility.error)
    return Response.json({ error: "unavailable" }, { status: 503, headers });
  if (!eligibility.data?.enabled)
    return Response.json({ error: "ineligible" }, { status: 403, headers });

  if (method === "GET") {
    const profile = await db
      .from("user_profiles")
      .select("user_id,display_name")
      .eq("user_id", session.userId)
      .maybeSingle();
    if (profile.error)
      return Response.json({ error: "unavailable" }, { status: 503, headers });
    return Response.json({ profile: profile.data }, { headers });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400, headers });
  }
  const parsed = ProfileInput.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: "invalid_body" }, { status: 400, headers });

  const mutation =
    method === "POST"
      ? await db
          .from("user_profiles")
          .insert({
            user_id: session.userId,
            display_name: parsed.data.displayName,
          })
          .select("user_id,display_name")
          .single()
      : await db
          .from("user_profiles")
          .update({ display_name: parsed.data.displayName })
          .eq("user_id", session.userId)
          .select("user_id,display_name")
          .maybeSingle();

  if (mutation.error) {
    const conflict = mutation.error.code === "23505";
    return Response.json(
      { error: conflict ? "profile_exists" : "unavailable" },
      { status: conflict ? 409 : 503, headers },
    );
  }
  if (!mutation.data)
    return Response.json({ error: "not_found" }, { status: 404, headers });
  return Response.json(
    { profile: mutation.data },
    {
      status: method === "POST" ? 201 : 200,
      headers,
    },
  );
}

export function GET(request: Request) {
  return handle(request, "GET");
}
export function POST(request: Request) {
  return handle(request, "POST");
}
export function PATCH(request: Request) {
  return handle(request, "PATCH");
}
