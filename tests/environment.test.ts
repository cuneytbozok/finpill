import { describe, expect, it } from "vitest";
import { PublicEnvironmentSchema, parseEnvironment } from "@finpill/contracts";
import { validateClientEnvironment } from "../apps/client/config/environment";
import { readServerEnvironment } from "../apps/api/src/server/environment-schema";

const localClient = {
  NEXT_PUBLIC_APP_ENV: "local",
  NEXT_PUBLIC_API_ORIGIN: "http://localhost:3001",
};
const localServer = {
  APP_ENV: "local",
  CLIENT_ORIGINS: "http://localhost:3000",
};

describe("public configuration", () => {
  it("requires an environment and an explicit origin when API access is enabled", () => {
    expect(() => validateClientEnvironment({})).toThrow();
    expect(() =>
      validateClientEnvironment({
        NEXT_PUBLIC_APP_ENV: "production",
        NEXT_PUBLIC_API_ENABLED: "true",
      }),
    ).toThrow();
  });
  it.each([
    "/api",
    "ftp://example.com",
    "https://user:password@example.com",
    "https://example.com/api",
    "https://example.com?token=secret",
    "https://example.com#fragment",
    "https://example.com/",
  ])("rejects non-origins: %s", (origin) => {
    expect(() =>
      validateClientEnvironment({
        ...localClient,
        NEXT_PUBLIC_API_ORIGIN: origin,
      }),
    ).toThrow();
  });
  it.each([
    "http://api.example.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://[::1]",
    "https://192.168.1.2",
    "https://172.20.1.2",
    "https://localhost.",
    "https://[fd00::1]",
    "https://intranet",
  ])("rejects hosted insecure/local origins: %s", (origin) => {
    for (const env of ["production"])
      expect(() =>
        validateClientEnvironment({
          ...localClient,
          NEXT_PUBLIC_APP_ENV: env,
          NEXT_PUBLIC_API_ORIGIN: origin,
        }),
      ).toThrow();
  });
  it("accepts explicitly configured hosted origins without fallback", () => {
    expect(
      validateClientEnvironment({
        NEXT_PUBLIC_APP_ENV: "production",
        NEXT_PUBLIC_API_ORIGIN: "https://api.example.com",
      }).NEXT_PUBLIC_API_ORIGIN,
    ).toBe("https://api.example.com");
  });
  it("accepts Vercel framework metadata without exposing it as app configuration", () => {
    const result = validateClientEnvironment({
      ...localClient,
      NEXT_PUBLIC_VERCEL_URL: "preview.vercel.app",
      NEXT_PUBLIC_VERCEL_ENV: "preview",
      NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: "test-sha",
      NEXT_PUBLIC_VERCEL_GIT_PREVIOUS_SHA: "previous-test-sha",
      NEXT_PUBLIC_VERCEL_PROJECT_ID: "test-project",
      NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG: '{"sampleRate":0}',
    });
    expect(result).toEqual(validateClientEnvironment(localClient));
  });

  it("does not broadly trust the Vercel prefix or leak rejected values", () => {
    for (const key of [
      "NEXT_PUBLIC_VERCEL_SECRET",
      "NEXT_PUBLIC_VERCEL_OIDC_TOKEN",
      "NEXT_PUBLIC_VERCEL_GIT_TOKEN",
      "NEXT_PUBLIC_API_ORGIN",
    ]) {
      expect(() =>
        validateClientEnvironment({ ...localClient, [key]: "private-canary" }),
      ).toThrow("allowlist");
      try {
        validateClientEnvironment({ ...localClient, [key]: "private-canary" });
      } catch (error) {
        expect(String(error)).toContain(key);
        expect(String(error)).not.toContain("private-canary");
      }
    }
  });

  it.each([
    ["production", "production"],
    ["development", "local"],
  ])(
    "binds Vercel %s to one application environment without app variables",
    (deployment, app) => {
      const result = validateClientEnvironment({
        VERCEL: "1",
        VERCEL_ENV: deployment,
        NEXT_PUBLIC_VERCEL_GIT_PREVIOUS_SHA: "",
      });
      expect(result.NEXT_PUBLIC_APP_ENV).toBe(app);
      expect(result.NEXT_PUBLIC_API_ENABLED).toBe(false);
      expect(result.NEXT_PUBLIC_API_ORIGIN).toBeUndefined();
    },
  );
  it("builds Vercel Preview with no application environment and integrations off", () => {
    const result = validateClientEnvironment({
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VERCEL_OIDC_TOKEN: "platform-token",
      NEXT_PUBLIC_VERCEL_URL: "preview.vercel.app",
      NEXT_PUBLIC_API_ORIGIN: "https://api.example.com",
      NEXT_PUBLIC_API_ENABLED: "false",
      NEXT_PUBLIC_DEEP_LINK_ORIGIN: "https://app.example.com",
      NODE_ENV: "production",
    });
    expect(result.NEXT_PUBLIC_APP_ENV).toBeUndefined();
    expect(result.NEXT_PUBLIC_API_ENABLED).toBe(false);
    expect(result.NEXT_PUBLIC_AUTH_ENABLED).toBe(false);
  });
  it.each([
    ["NEXT_PUBLIC_APP_ENV", "production"],
    ["NEXT_PUBLIC_APP_ENV", "local"],
    ["NEXT_PUBLIC_API_ENABLED", "true"],
    ["NEXT_PUBLIC_AUTH_ENABLED", "true"],
    ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fake"],
    ["CLERK_SECRET_KEY", "sk_test_private-canary"],
    ["SUPABASE_SECRET_KEY", "sb_secret_private-canary"],
    ["SUPABASE_URL", "https://project.supabase.co"],
    ["DATABASE_URL", "postgres://private-canary"],
    ["KAP_API_KEY", "private-canary"],
    ["ANTHROPIC_API_KEY", "private-canary"],
    ["MARKET_DATA_TOKEN", "private-canary"],
  ])("rejects %s in a Vercel Preview client build", (key, value) => {
    const env = { VERCEL: "1", VERCEL_ENV: "preview", [key]: value };
    expect(() => validateClientEnvironment(env)).toThrow(key);
    expect(() => validateClientEnvironment(env)).not.toThrow("private-canary");
  });
  it("does not default unrecognized deployments or allow cross-binding", () => {
    expect(() =>
      validateClientEnvironment({ VERCEL: "1", VERCEL_ENV: "unknown" }),
    ).toThrow();
    expect(() =>
      validateClientEnvironment({ VERCEL_ENV: "preview" }),
    ).toThrow();
    for (const [deployment, app] of [
      ["production", "local"],
      ["development", "production"],
    ])
      expect(() =>
        validateClientEnvironment({
          VERCEL: "1",
          VERCEL_ENV: deployment,
          NEXT_PUBLIC_APP_ENV: app,
        }),
      ).toThrow("NEXT_PUBLIC_APP_ENV");
    expect(() =>
      validateClientEnvironment({ NEXT_PUBLIC_APP_ENV: "staging" }),
    ).toThrow("NEXT_PUBLIC_APP_ENV");
  });
  it("keeps an absent application environment integration-free at runtime", () => {
    for (const bad of [
      {
        NEXT_PUBLIC_API_ENABLED: "true",
        NEXT_PUBLIC_API_ORIGIN: "https://api.example.com",
      },
      {
        NEXT_PUBLIC_AUTH_ENABLED: "true",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fake",
      },
      { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fake" },
    ])
      expect(() => parseEnvironment(PublicEnvironmentSchema, bad)).toThrow();
  });
  it("requires live publishable keys for Production auth only", () => {
    const production = {
      NEXT_PUBLIC_APP_ENV: "production",
      NEXT_PUBLIC_API_ENABLED: "true",
      NEXT_PUBLIC_API_ORIGIN: "https://api.example.com",
    };
    expect(validateClientEnvironment(production).NEXT_PUBLIC_AUTH_ENABLED).toBe(
      false,
    );
    expect(() =>
      validateClientEnvironment({
        ...production,
        NEXT_PUBLIC_AUTH_ENABLED: "true",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fake",
      }),
    ).toThrow("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
    expect(
      validateClientEnvironment({
        ...production,
        NEXT_PUBLIC_AUTH_ENABLED: "true",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_fake",
      }).NEXT_PUBLIC_AUTH_ENABLED,
    ).toBe(true);
  });
  it("exposes only allowlisted public settings", () => {
    expect(
      parseEnvironment(PublicEnvironmentSchema, {
        ...localClient,
        KAP_API_SECRET: "private-canary",
      }),
    ).not.toHaveProperty("KAP_API_SECRET");
    expect(() =>
      validateClientEnvironment({
        ...localClient,
        NEXT_PUBLIC_KAP_API_SECRET: "private-canary",
      }),
    ).toThrow("allowlist");
  });
  it("requires strict flags and environment-appropriate auth keys", () => {
    expect(
      validateClientEnvironment(localClient).NEXT_PUBLIC_AUTH_ENABLED,
    ).toBe(false);
    for (const flag of ["yes", "1", "", "FALSE"])
      expect(() =>
        validateClientEnvironment({
          ...localClient,
          NEXT_PUBLIC_AUTH_ENABLED: flag,
        }),
      ).toThrow();
    expect(() =>
      validateClientEnvironment({
        ...localClient,
        NEXT_PUBLIC_AUTH_ENABLED: "true",
      }),
    ).toThrow();
    expect(() =>
      validateClientEnvironment({
        ...localClient,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "sk_test_fake",
      }),
    ).toThrow();
    expect(
      validateClientEnvironment({
        ...localClient,
        NEXT_PUBLIC_AUTH_ENABLED: "true",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fake",
      }).NEXT_PUBLIC_AUTH_ENABLED,
    ).toBe(true);
  });
});

describe("server configuration", () => {
  it("requires environment and origins without service credentials for disabled features", () => {
    expect(() => readServerEnvironment({})).toThrow();
    expect(readServerEnvironment(localServer).KAP_ENABLED).toBe(false);
    for (const origins of [
      "",
      "*",
      "https://example.com/path",
      "https://example.com,",
    ])
      expect(() =>
        readServerEnvironment({ ...localServer, CLIENT_ORIGINS: origins }),
      ).toThrow();
    expect(
      readServerEnvironment({
        ...localServer,
        CLIENT_ORIGINS: "https://a.example.com,https://b.example.com",
      }).CLIENT_ORIGINS,
    ).toHaveLength(2);
  });
  it.each([
    "AUTH_ENABLED",
    "DATABASE_ENABLED",
    "PRIVILEGED_DATA_ENABLED",
    "KAP_ENABLED",
  ])("requires enabled feature credentials: %s", (flag) => {
    expect(() =>
      readServerEnvironment({ ...localServer, [flag]: "true" }),
    ).toThrow();
  });
  it("validates complete auth/database/basic and token KAP configurations", () => {
    const complete = {
      ...localServer,
      AUTH_ENABLED: "true",
      CLERK_SECRET_KEY: "sk_test_fake",
      CLERK_JWT_ISSUER: "https://clerk.example.com",
      DATABASE_ENABLED: "true",
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake",
      SUPABASE_SECRET_KEY: "sb_secret_fake",
      KAP_ENABLED: "true",
      KAP_ENV: "development",
      KAP_BASE_URL: "https://apigwdev.mkk.com.tr/api/vyk",
      KAP_AUTH_MODE: "basic",
      KAP_API_KEY: "fake",
      KAP_API_SECRET: "fake",
    };
    expect(readServerEnvironment(complete).KAP_AUTH_MODE).toBe("basic");
    const { KAP_API_SECRET: omitted, ...token } = complete;
    void omitted;
    expect(
      readServerEnvironment({ ...token, KAP_AUTH_MODE: "token" }).KAP_AUTH_MODE,
    ).toBe("token");
    expect(() => readServerEnvironment(token)).toThrow("KAP_API_SECRET");
  });
  it("does not accept local services or known development credentials in production", () => {
    const production = {
      APP_ENV: "production",
      CLIENT_ORIGINS: "https://app.example.com",
    };
    for (const bad of [
      { CLIENT_ORIGINS: "http://localhost:3000" },
      { SUPABASE_URL: "http://127.0.0.1:54321" },
      { CLERK_SECRET_KEY: "sk_test_fake" },
      { KAP_ENV: "development" },
      { KAP_BASE_URL: "https://apigwdev.mkk.com.tr/api/vyk" },
    ])
      expect(() => readServerEnvironment({ ...production, ...bad })).toThrow();
  });
  it("keeps privileged database credentials separate from user access", () => {
    const userData = {
      ...localServer,
      DATABASE_ENABLED: "true",
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake",
    };
    expect(readServerEnvironment(userData).DATABASE_ENABLED).toBe(true);
    expect(() =>
      readServerEnvironment({ ...userData, PRIVILEGED_DATA_ENABLED: "true" }),
    ).toThrow("SUPABASE_SECRET_KEY");
    expect(
      readServerEnvironment({
        ...userData,
        PRIVILEGED_DATA_ENABLED: "true",
        SUPABASE_SECRET_KEY: "sb_secret_fake",
      }).PRIVILEGED_DATA_ENABLED,
    ).toBe(true);
    expect(() =>
      readServerEnvironment({
        ...userData,
        SUPABASE_PUBLISHABLE_KEY: "sb_secret_fake",
      }),
    ).toThrow("SUPABASE_PUBLISHABLE_KEY");
  });

  it("binds Vercel Production and Development to one explicit environment", () => {
    const hosted = { VERCEL: "1", CLIENT_ORIGINS: "https://app.example.com" };
    expect(
      readServerEnvironment({
        ...hosted,
        VERCEL_ENV: "production",
        APP_ENV: "production",
      }).APP_ENV,
    ).toBe("production");
    for (const [vercelEnv, appEnv] of [
      ["production", undefined],
      ["production", "local"],
      ["development", "production"],
      ["unknown", "production"],
    ])
      expect(() =>
        readServerEnvironment({
          ...hosted,
          VERCEL_ENV: vercelEnv,
          APP_ENV: appEnv,
        }),
      ).toThrow("APP_ENV");
    expect(() =>
      readServerEnvironment({ ...localServer, APP_ENV: "staging" }),
    ).toThrow("APP_ENV");
  });

  const preview = {
    VERCEL: "1",
    VERCEL_ENV: "preview",
    CLIENT_ORIGINS: "https://preview.example.com",
  };
  it("runs Vercel Preview with no application environment and integrations off", () => {
    const result = readServerEnvironment({
      ...preview,
      VERCEL_OIDC_TOKEN: "platform-token",
      VERCEL_GIT_COMMIT_SHA: "sha",
      AUTH_ENABLED: "false",
      NODE_ENV: "production",
      LOG_LEVEL: "info",
    });
    expect(result.APP_ENV).toBeUndefined();
    expect(result.AUTH_ENABLED).toBe(false);
    expect(result.DATABASE_ENABLED).toBe(false);
    expect(() =>
      readServerEnvironment({
        ...preview,
        CLIENT_ORIGINS: "http://localhost:3000",
      }),
    ).toThrow("CLIENT_ORIGINS");
  });
  it.each([
    ["APP_ENV", "production"],
    ["APP_ENV", "local"],
    ["AUTH_ENABLED", "true"],
    ["DATABASE_ENABLED", "true"],
    ["PRIVILEGED_DATA_ENABLED", "true"],
    ["KAP_ENABLED", "true"],
    ["CLERK_SECRET_KEY", "sk_test_private-canary"],
    ["CLERK_JWT_ISSUER", "https://example.clerk.accounts.dev"],
    ["SUPABASE_URL", "https://project.supabase.co"],
    ["SUPABASE_PUBLISHABLE_KEY", "sb_publishable_private-canary"],
    ["SUPABASE_SECRET_KEY", "sb_secret_private-canary"],
    ["SUPABASE_SERVICE_ROLE_KEY", "private-canary"],
    ["DATABASE_URL", "postgres://private-canary"],
    ["PGPASSWORD", "private-canary"],
    ["KAP_BASE_URL", "https://example.com"],
    ["KAP_API_SECRET", "private-canary"],
    ["OPENAI_API_KEY", "private-canary"],
    ["AI_GATEWAY_API_KEY", "private-canary"],
    ["MARKET_DATA_SECRET", "private-canary"],
  ])("rejects %s in a Vercel Preview API", (key, value) => {
    const env = { ...preview, [key]: value };
    expect(() => readServerEnvironment(env)).toThrow(key);
    try {
      readServerEnvironment(env);
    } catch (error) {
      expect(String(error)).not.toContain("private-canary");
    }
  });

  it("requires no Clerk configuration for Production with auth disabled", () => {
    const production = {
      APP_ENV: "production",
      CLIENT_ORIGINS: "https://app.example.com",
    };
    expect(readServerEnvironment(production).AUTH_ENABLED).toBe(false);
    const auth = {
      ...production,
      AUTH_ENABLED: "true",
      CLERK_SECRET_KEY: "sk_live_fake",
      CLERK_JWT_ISSUER: "https://clerk.example.com",
    };
    expect(readServerEnvironment(auth).AUTH_ENABLED).toBe(true);
    expect(() =>
      readServerEnvironment({ ...production, AUTH_ENABLED: "true" }),
    ).toThrow("CLERK_SECRET_KEY");
    expect(() =>
      readServerEnvironment({ ...auth, CLERK_SECRET_KEY: "sk_test_fake" }),
    ).toThrow("CLERK_SECRET_KEY");
    for (const issuer of [
      "https://ample-chicken-233.clerk.accounts.dev",
      "https://another-instance.clerk.accounts.dev",
      "https://X.Clerk.Accounts.Dev.",
    ])
      expect(() =>
        readServerEnvironment({ ...auth, CLERK_JWT_ISSUER: issuer }),
      ).toThrow("CLERK_JWT_ISSUER");
  });

  it("keeps Local and automated processes away from Production services", () => {
    expect(() =>
      readServerEnvironment({
        ...localServer,
        DATABASE_ENABLED: "true",
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake",
      }),
    ).toThrow("SUPABASE_URL");
    const production = {
      CI: "true",
      APP_ENV: "production",
      CLIENT_ORIGINS: "https://app.example.com",
    };
    expect(readServerEnvironment(production).APP_ENV).toBe("production");
    expect(() =>
      readServerEnvironment({
        ...production,
        DATABASE_ENABLED: "true",
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake",
      }),
    ).toThrow("CI");
    expect(() =>
      readServerEnvironment({
        ...production,
        AUTH_ENABLED: "true",
        CLERK_SECRET_KEY: "sk_live_fake",
        CLERK_JWT_ISSUER: "https://clerk.example.com",
      }),
    ).toThrow("CI");
  });

  it("never includes submitted credentials or raw validation details in errors", () => {
    const secret = "canary-do-not-log";
    try {
      readServerEnvironment({
        ...localServer,
        KAP_AUTH_MODE: "token",
        KAP_BASE_URL: secret,
        CLERK_SECRET_KEY: secret,
      });
      throw new Error("unexpected success");
    } catch (error) {
      expect(String(error)).toContain("Invalid environment configuration");
      expect(String(error)).not.toContain(secret);
      expect(error).not.toHaveProperty("cause");
      expect(error).not.toHaveProperty("issues");
    }
  });
});
