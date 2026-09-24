import { z } from "zod";

// Application/data environments. A Vercel Preview is a deployment context with
// no application environment; it is represented by an absent value.
export const EnvironmentSchema = z.enum(["local", "production"]);

// Integration switches that would need credentials when enabled.
const integrationSwitches = [
  "NEXT_PUBLIC_API_ENABLED",
  "NEXT_PUBLIC_AUTH_ENABLED",
  "AUTH_ENABLED",
  "DATABASE_ENABLED",
  "PRIVILEGED_DATA_ENABLED",
  "KAP_ENABLED",
];
// Finpill identity/data/source settings and provider credential shapes.
// Vercel system variables are the platform's own and are exempt.
const credentialName =
  /^(?:NEXT_PUBLIC_CLERK_|CLERK_|SUPABASE_|KAP_|DATABASE_URL$|POSTGRES_|PG(?:HOST|USER|PASSWORD|DATABASE|PORT)$)|(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|CREDENTIALS?)(?:_|$)/;
const platformName = /^(?:NEXT_PUBLIC_)?VERCEL_/;

// Names (never values) that make a Preview build/runtime unacceptable.
export function previewViolations(env: Record<string, string | undefined>) {
  return Object.keys(env)
    .filter((key) => {
      const value = env[key];
      if (value === undefined || value === "") return false;
      if (integrationSwitches.includes(key)) return value !== "false";
      if (key === "APP_ENV" || key === "NEXT_PUBLIC_APP_ENV") return true;
      return !platformName.test(key) && credentialName.test(key);
    })
    .sort();
}

export function assertCredentialFreePreview(
  env: Record<string, string | undefined>,
) {
  const violations = previewViolations(env);
  if (violations.length > 0)
    throw new Error(
      `Invalid environment configuration: Vercel Preview must stay credential-free with integrations disabled: ${violations.join(", ")}`,
    );
}

export const FeatureFlagSchema = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

// An origin is deliberately narrower than a URL: no credentials, paths or query.
export const OriginSchema = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && value === url.origin;
  } catch {
    return false;
  }
});

export function isHostedOrigin(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  return (
    url.protocol === "https:" &&
    !(
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.startsWith("[") ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
      !host.includes(".")
    )
  );
}

export const PublicEnvironmentSchema = z
  .object({
    // Absent only in a credential-free Preview build (see the client adapter).
    NEXT_PUBLIC_APP_ENV: EnvironmentSchema.optional(),
    NEXT_PUBLIC_API_ENABLED: FeatureFlagSchema,
    NEXT_PUBLIC_API_ORIGIN: OriginSchema.optional(),
    NEXT_PUBLIC_AUTH_ENABLED: FeatureFlagSchema,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_DEEP_LINK_ORIGIN: OriginSchema.optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NEXT_PUBLIC_APP_ENV === undefined) {
      for (const key of [
        "NEXT_PUBLIC_API_ENABLED",
        "NEXT_PUBLIC_AUTH_ENABLED",
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      ] as const)
        if (env[key])
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Preview builds keep integrations disabled",
          });
    }
    if (env.NEXT_PUBLIC_API_ENABLED && !env.NEXT_PUBLIC_API_ORIGIN) {
      ctx.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_API_ORIGIN"],
        message: "Enabled API requires an explicit origin",
      });
    }
    if (
      env.NEXT_PUBLIC_API_ORIGIN !== undefined &&
      env.NEXT_PUBLIC_APP_ENV !== "local" &&
      !isHostedOrigin(env.NEXT_PUBLIC_API_ORIGIN)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_API_ORIGIN"],
        message:
          "Hosted environments require an HTTPS origin outside local networks",
      });
    }
    if (
      env.NEXT_PUBLIC_DEEP_LINK_ORIGIN !== undefined &&
      !isHostedOrigin(env.NEXT_PUBLIC_DEEP_LINK_ORIGIN)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_DEEP_LINK_ORIGIN"],
        message: "Deep links require a hosted HTTPS origin",
      });
    }
    if (
      env.NEXT_PUBLIC_AUTH_ENABLED ||
      env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== undefined
    ) {
      const prefix =
        env.NEXT_PUBLIC_APP_ENV === "production" ? "pk_live_" : "pk_test_";
      if (
        !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith(prefix) ||
        env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.length <= prefix.length
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"],
          message: "Environment-appropriate publishable key required",
        });
      }
    }
  });

// Never include Zod issues, submitted values, or an error cause in config errors.
export function parseEnvironment<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(
        result.error.issues.map(
          (issue) => issue.path.join(".") || "configuration",
        ),
      ),
    ];
    throw new Error(`Invalid environment configuration: ${fields.join(", ")}`);
  }
  return result.data;
}
