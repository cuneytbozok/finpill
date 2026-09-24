import { z } from "zod";
import {
  EnvironmentSchema,
  assertCredentialFreePreview,
  FeatureFlagSchema,
  OriginSchema,
  isHostedOrigin,
  parseEnvironment,
} from "@finpill/contracts/environment";

function isClerkDevelopmentIssuer(value: string) {
  try {
    return new URL(value).hostname
      .toLowerCase()
      .replace(/\.$/, "")
      .endsWith(".clerk.accounts.dev");
  } catch {
    return true;
  }
}

const secret = z
  .string()
  .min(1)
  .refine((value) => value === value.trim());
const url = z.string().url();
export const ServerEnvironmentSchema = z
  .object({
    // Absent only in a credential-free Vercel Preview (see the reader below).
    APP_ENV: EnvironmentSchema.optional(),
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
    if (env.APP_ENV === undefined) {
      for (const key of [
        "AUTH_ENABLED",
        "DATABASE_ENABLED",
        "PRIVILEGED_DATA_ENABLED",
        "KAP_ENABLED",
      ] as const)
        if (env[key]) issue(key);
    }
    // Local may use the hosted project with user-scoped access only; the
    // privileged key never leaves the hosting provider's secret store.
    if (
      env.APP_ENV === "local" &&
      env.SUPABASE_URL &&
      isHostedOrigin(env.SUPABASE_URL) &&
      env.PRIVILEGED_DATA_ENABLED
    )
      issue("PRIVILEGED_DATA_ENABLED");
    // Clerk development instances issue from *.clerk.accounts.dev.
    if (
      env.APP_ENV === "production" &&
      env.CLERK_JWT_ISSUER &&
      isClerkDevelopmentIssuer(env.CLERK_JWT_ISSUER)
    )
      issue("CLERK_JWT_ISSUER");
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

const deploymentBinding: Record<string, string> = {
  production: "production",
  development: "local",
};

export function readServerEnvironment(env: NodeJS.ProcessEnv) {
  // Vercel deployment context is not an application environment. Preview has
  // none and must be credential-free; elsewhere APP_ENV is always explicit.
  if (env.VERCEL === "1" && env.VERCEL_ENV === "preview") {
    assertCredentialFreePreview(env);
  } else if (
    !env.APP_ENV ||
    (env.VERCEL === "1" &&
      env.APP_ENV !== deploymentBinding[env.VERCEL_ENV ?? ""])
  ) {
    throw new Error("Invalid environment configuration: APP_ENV");
  }
  const parsed = parseEnvironment(ServerEnvironmentSchema, env);
  // Automated processes may build a Production artifact to test it, but never
  // with an integration that would reach Production services.
  if (
    env.CI &&
    env.VERCEL !== "1" &&
    parsed.APP_ENV === "production" &&
    (parsed.AUTH_ENABLED ||
      parsed.DATABASE_ENABLED ||
      parsed.PRIVILEGED_DATA_ENABLED ||
      parsed.KAP_ENABLED)
  )
    throw new Error("Invalid environment configuration: CI");
  // CI uses disposable local databases only, never the hosted project.
  if (
    env.CI &&
    env.VERCEL !== "1" &&
    parsed.SUPABASE_URL &&
    isHostedOrigin(parsed.SUPABASE_URL)
  )
    throw new Error("Invalid environment configuration: CI");
  return parsed;
}
