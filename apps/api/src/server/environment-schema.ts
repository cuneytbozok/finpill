import { z } from "zod";
import {
  EnvironmentSchema,
  FeatureFlagSchema,
  OriginSchema,
  isHostedOrigin,
  parseEnvironment,
} from "@finpill/contracts/environment";

const secret = z
  .string()
  .min(1)
  .refine((value) => value === value.trim());
const url = z.string().url();
export const ServerEnvironmentSchema = z
  .object({
    APP_ENV: EnvironmentSchema,
    CLIENT_ORIGINS: z
      .string()
      .transform((value) => value.split(","))
      .pipe(z.array(OriginSchema).min(1)),
    AUTH_ENABLED: FeatureFlagSchema,
    CLERK_SECRET_KEY: secret.optional(),
    CLERK_JWT_ISSUER: OriginSchema.optional(),
    DATABASE_ENABLED: FeatureFlagSchema,
    PRIVILEGED_DATA_ENABLED: FeatureFlagSchema,
    SUPABASE_URL: OriginSchema.optional(),
    SUPABASE_PUBLISHABLE_KEY: secret
      .refine((value) => value.startsWith("sb_publishable_"))
      .optional(),
    SUPABASE_SECRET_KEY: secret
      .refine((value) => value.startsWith("sb_secret_"))
      .optional(),
    KAP_ENABLED: FeatureFlagSchema,
    KAP_ENV: z.enum(["development", "production"]).optional(),
    KAP_BASE_URL: url.optional(),
    KAP_AUTH_MODE: z.enum(["basic", "token"]).optional(),
    KAP_API_KEY: secret.optional(),
    KAP_API_SECRET: secret.optional(),
  })
  .superRefine((env, ctx) => {
    function issue(key: string) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: "Missing or incompatible setting",
      });
    }
    if (env.APP_ENV !== "local") {
      if (env.CLIENT_ORIGINS.some((origin) => !isHostedOrigin(origin)))
        issue("CLIENT_ORIGINS");
      for (const key of ["SUPABASE_URL", "CLERK_JWT_ISSUER"] as const) {
        if (env[key] && !isHostedOrigin(env[key])) issue(key);
      }
    }
    if (env.AUTH_ENABLED) {
      if (!env.CLERK_SECRET_KEY) issue("CLERK_SECRET_KEY");
      if (!env.CLERK_JWT_ISSUER) issue("CLERK_JWT_ISSUER");
    }
    if (env.CLERK_SECRET_KEY) {
      const prefix = env.APP_ENV === "production" ? "sk_live_" : "sk_test_";
      if (
        !env.CLERK_SECRET_KEY.startsWith(prefix) ||
        env.CLERK_SECRET_KEY.length <= prefix.length
      )
        issue("CLERK_SECRET_KEY");
    }
    if (env.DATABASE_ENABLED) {
      for (const key of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"] as const) {
        if (!env[key]) issue(key);
      }
    }
    if (env.PRIVILEGED_DATA_ENABLED) {
      if (!env.DATABASE_ENABLED) issue("DATABASE_ENABLED");
      if (!env.SUPABASE_SECRET_KEY) issue("SUPABASE_SECRET_KEY");
    }
    if (env.KAP_ENABLED) {
      for (const key of [
        "KAP_ENV",
        "KAP_BASE_URL",
        "KAP_AUTH_MODE",
        "KAP_API_KEY",
      ] as const) {
        if (!env[key]) issue(key);
      }
      if (env.KAP_AUTH_MODE === "basic" && !env.KAP_API_SECRET)
        issue("KAP_API_SECRET");
    }
    if (env.APP_ENV === "production" && (env.KAP_ENABLED || env.KAP_ENV)) {
      if (env.KAP_ENV !== "production") issue("KAP_ENV");
    }
    if (env.KAP_BASE_URL) {
      let endpoint: URL;
      try {
        endpoint = new URL(env.KAP_BASE_URL);
      } catch {
        issue("KAP_BASE_URL");
        return;
      }
      if (
        !["http:", "https:"].includes(endpoint.protocol) ||
        endpoint.username ||
        endpoint.password ||
        endpoint.search ||
        endpoint.hash
      )
        issue("KAP_BASE_URL");
      if (env.APP_ENV !== "local" && !isHostedOrigin(endpoint.origin))
        issue("KAP_BASE_URL");
      if (
        env.APP_ENV === "production" &&
        endpoint.hostname.toLowerCase().replace(/\.$/, "") ===
          "apigwdev.mkk.com.tr"
      )
        issue("KAP_BASE_URL");
    }
  });

export function readServerEnvironment(env: NodeJS.ProcessEnv) {
  const parsed = parseEnvironment(ServerEnvironmentSchema, env);
  if (env.VERCEL === "1") {
    const expected =
      env.VERCEL_ENV === "production"
        ? "production"
        : env.VERCEL_ENV === "preview"
          ? "staging"
          : env.VERCEL_ENV === "development"
            ? "local"
            : undefined;
    if (!expected || parsed.APP_ENV !== expected) {
      throw new Error("Invalid environment configuration: APP_ENV");
    }
  }
  if (parsed.DATABASE_ENABLED && parsed.SUPABASE_URL) {
    const stagingProject = "https://gsgkoiwjkqbkuyyafzbf.supabase.co";
    if (
      (parsed.APP_ENV === "staging" &&
        parsed.SUPABASE_URL !== stagingProject) ||
      (parsed.APP_ENV === "production" &&
        parsed.SUPABASE_URL === stagingProject)
    ) {
      throw new Error("Invalid environment configuration: SUPABASE_URL");
    }
  }
  if (
    parsed.APP_ENV === "production" &&
    parsed.CLERK_JWT_ISSUER === "https://ample-chicken-233.clerk.accounts.dev"
  ) {
    throw new Error("Invalid environment configuration: CLERK_JWT_ISSUER");
  }
  return parsed;
}
