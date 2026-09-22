import { z } from "zod";

export const EnvironmentSchema = z.enum(["local", "staging", "production"]);
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
    NEXT_PUBLIC_APP_ENV: EnvironmentSchema,
    NEXT_PUBLIC_API_ORIGIN: OriginSchema,
    NEXT_PUBLIC_AUTH_ENABLED: FeatureFlagSchema,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (
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
