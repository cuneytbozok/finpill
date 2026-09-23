import "server-only";
import { createClient } from "@supabase/supabase-js";

import type { ServerEnvironmentSchema } from "./environment-schema";
import type { z } from "zod";

type ServerEnvironment = z.infer<typeof ServerEnvironmentSchema>;

/** One request, one verified Clerk session, and a publishable database key. */
export function createUserDatabaseClient(
  env: ServerEnvironment,
  bearerToken: string,
) {
  if (
    !env.AUTH_ENABLED ||
    !env.DATABASE_ENABLED ||
    !env.SUPABASE_URL ||
    !env.SUPABASE_PUBLISHABLE_KEY ||
    !bearerToken
  )
    throw new Error("User database access is not configured");

  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    accessToken: async () => bearerToken,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
