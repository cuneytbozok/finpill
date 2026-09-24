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
    for (const env of ["staging", "production"])
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
    ["preview", "staging"],
    ["production", "production"],
    ["development", "local"],
  ])(
    "builds an API-disabled scaffold on Vercel %s without app variables",
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
  it("does not default unrecognized deployments or override explicit configuration", () => {
    expect(() =>
      validateClientEnvironment({ VERCEL: "1", VERCEL_ENV: "unknown" }),
    ).toThrow();
    expect(() =>
      validateClientEnvironment({ VERCEL_ENV: "preview" }),
    ).toThrow();
    expect(() =>
      validateClientEnvironment({
        VERCEL: "1",
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_APP_ENV: "",
      }),
    ).toThrow();
    expect(
      validateClientEnvironment({
        VERCEL: "1",
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_APP_ENV: "production",
      }).NEXT_PUBLIC_APP_ENV,
    ).toBe("production");
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

  it("binds hosted builds to their Vercel deployment environment", () => {
    expect(
      readServerEnvironment({
        VERCEL: "1",
        VERCEL_ENV: "preview",
        APP_ENV: "staging",
        CLIENT_ORIGINS: "https://preview.example.com",
      }).APP_ENV,
    ).toBe("staging");
    for (const [vercelEnv, appEnv] of [
      ["preview", "production"],
      ["production", "staging"],
      ["unknown", "staging"],
    ]) {
      expect(() =>
        readServerEnvironment({
          VERCEL: "1",
          VERCEL_ENV: vercelEnv,
          APP_ENV: appEnv,
          CLIENT_ORIGINS: "https://app.example.com",
        }),
      ).toThrow("APP_ENV");
    }
  });

  it("pins staging data and rejects its use in production", () => {
    const database = {
      DATABASE_ENABLED: "true",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake",
    };
    const stagingUrl = "https://gsgkoiwjkqbkuyyafzbf.supabase.co";
    const staging = {
      ...database,
      APP_ENV: "staging",
      CLIENT_ORIGINS: "https://preview.example.com",
    };
    expect(
      readServerEnvironment({ ...staging, SUPABASE_URL: stagingUrl })
        .DATABASE_ENABLED,
    ).toBe(true);
    expect(() =>
      readServerEnvironment({
        ...staging,
        SUPABASE_URL: "https://other-project.supabase.co",
      }),
    ).toThrow("SUPABASE_URL");
    expect(() =>
      readServerEnvironment({
        ...staging,
        APP_ENV: "production",
        SUPABASE_URL: stagingUrl,
      }),
    ).toThrow("SUPABASE_URL");
    expect(() =>
      readServerEnvironment({
        APP_ENV: "production",
        CLIENT_ORIGINS: "https://app.example.com",
        CLERK_JWT_ISSUER: "https://ample-chicken-233.clerk.accounts.dev",
      }),
    ).toThrow("CLERK_JWT_ISSUER");
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
