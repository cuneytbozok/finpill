import { verifyToken } from "@clerk/backend";

import type { ServerEnvironmentSchema } from "./environment-schema";
import type { z } from "zod";

type ServerEnvironment = z.infer<typeof ServerEnvironmentSchema>;
type VerifiedSession = { userId: string; sessionId: string };

export async function verifyBearerSession(
  authorization: string | null,
  env: ServerEnvironment,
  verify: typeof verifyToken = verifyToken,
): Promise<VerifiedSession | null> {
  if (!env.AUTH_ENABLED || !env.CLERK_SECRET_KEY || !env.CLERK_JWT_ISSUER)
    return null;
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(authorization ?? "");
  if (!match) return null;

  try {
    const claims = await verify(match[1]!, {
      secretKey: env.CLERK_SECRET_KEY,
      authorizedParties: env.CLIENT_ORIGINS,
    });
    if (
      claims.iss !== env.CLERK_JWT_ISSUER ||
      typeof claims.azp !== "string" ||
      !env.CLIENT_ORIGINS.includes(claims.azp) ||
      typeof claims.sub !== "string" ||
      !claims.sub.startsWith("user_") ||
      typeof claims.sid !== "string" ||
      !claims.sid.startsWith("sess_")
    )
      return null;
    return { userId: claims.sub, sessionId: claims.sid };
  } catch {
    return null;
  }
}
