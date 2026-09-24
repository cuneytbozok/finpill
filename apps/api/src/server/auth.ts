import { verifyToken } from "@clerk/backend";

import { IOS_WEBVIEW_ORIGIN } from "./environment-schema";

import type { ServerEnvironmentSchema } from "./environment-schema";
import type { z } from "zod";

type ServerEnvironment = z.infer<typeof ServerEnvironmentSchema>;
type VerifiedSession = { userId: string; sessionId: string };

// Fixed origins of the Capacitor WebViews (iOS, Android).
const nativeWebViewOrigins = new Set([IOS_WEBVIEW_ORIGIN, "https://localhost"]);

/**
 * Browser session tokens name their client origin in `azp`. Native Clerk SDKs
 * issue tokens without `azp`; those are accepted only from a configured native
 * WebView origin, and a native request never accepts a browser token.
 */
export async function verifyBearerSession(
  authorization: string | null,
  env: ServerEnvironment,
  origin: string | null = null,
  verify: typeof verifyToken = verifyToken,
): Promise<VerifiedSession | null> {
  if (!env.AUTH_ENABLED || !env.CLERK_SECRET_KEY || !env.CLERK_JWT_ISSUER)
    return null;
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(authorization ?? "");
  if (!match) return null;
  const native =
    origin !== null &&
    nativeWebViewOrigins.has(origin) &&
    env.CLIENT_ORIGINS.includes(origin);

  try {
    const claims = await verify(match[1]!, {
      secretKey: env.CLERK_SECRET_KEY,
      ...(native ? {} : { authorizedParties: env.CLIENT_ORIGINS }),
    });
    if (
      claims.iss !== env.CLERK_JWT_ISSUER ||
      (native
        ? claims.azp !== undefined
        : typeof claims.azp !== "string" ||
          !env.CLIENT_ORIGINS.includes(claims.azp)) ||
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
