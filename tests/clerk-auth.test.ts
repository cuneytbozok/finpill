import { verifyToken } from "@clerk/backend";
import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyBearerSession } from "../apps/api/src/server/auth";
import { readServerEnvironment } from "../apps/api/src/server/environment-schema";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const now = Math.floor(Date.now() / 1000);
const environment = readServerEnvironment({
  APP_ENV: "local",
  CLIENT_ORIGINS: "http://localhost:3000",
  AUTH_ENABLED: "true",
  CLERK_SECRET_KEY: "sk_test_fixture",
  CLERK_JWT_ISSUER: "https://issuer.example.com",
});
const verifier: typeof verifyToken = (token, options) =>
  verifyToken(token, { ...options, jwtKey: publicKey });

function token(overrides: Record<string, unknown> = {}) {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const signingInput = [
    encode({ alg: "RS256", typ: "JWT", kid: "test" }),
    encode({
      iss: environment.CLERK_JWT_ISSUER,
      sub: "user_invited",
      sid: "sess_active",
      azp: "http://localhost:3000",
      iat: now - 10,
      nbf: now - 10,
      exp: now + 300,
      ...overrides,
    }),
  ].join(".");
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), privateKey);
  return `${signingInput}.${signature.toString("base64url")}`;
}

describe("Clerk bearer authentication", () => {
  it("accepts a signed, current session from the configured instance and client", async () => {
    await expect(
      verifyBearerSession(`Bearer ${token()}`, environment, null, verifier),
    ).resolves.toEqual({ userId: "user_invited", sessionId: "sess_active" });
  });

  it.each([
    ["missing", null],
    ["cookie-only", "Basic opaque"],
    ["expired", `Bearer ${token({ exp: now - 60 })}`],
    ["wrong issuer", `Bearer ${token({ iss: "https://other.example.com" })}`],
    ["wrong client", `Bearer ${token({ azp: "https://other.example.com" })}`],
    ["no client", `Bearer ${token({ azp: undefined })}`],
    ["future", `Bearer ${token({ nbf: now + 60 })}`],
    ["no session", `Bearer ${token({ sid: undefined })}`],
    ["bad signature", `Bearer ${token().slice(0, -2)}xx`],
  ])("rejects %s", async (_case, authorization) => {
    await expect(
      verifyBearerSession(authorization, environment, null, verifier),
    ).resolves.toBeNull();
  });

  describe("native WebView requests", () => {
    const native = readServerEnvironment({
      APP_ENV: "local",
      CLIENT_ORIGINS:
        "http://localhost:3000,capacitor://localhost,https://localhost",
      AUTH_ENABLED: "true",
      CLERK_SECRET_KEY: "sk_test_fixture",
      CLERK_JWT_ISSUER: "https://issuer.example.com",
    });
    const nativeToken = `Bearer ${token({ azp: undefined })}`;

    it.each(["capacitor://localhost", "https://localhost"])(
      "accepts a native SDK token without azp from %s",
      async (origin) => {
        await expect(
          verifyBearerSession(nativeToken, native, origin, verifier),
        ).resolves.toEqual({
          userId: "user_invited",
          sessionId: "sess_active",
        });
      },
    );

    it.each([
      ["a browser token", `Bearer ${token()}`, "capacitor://localhost"],
      ["an unlisted native origin", nativeToken, "capacitor://localhost"],
      ["a browser origin", nativeToken, "http://localhost:3000"],
      ["no origin", nativeToken, null],
      [
        "a wrong issuer",
        `Bearer ${token({ azp: undefined, iss: "https://other.example.com" })}`,
        "https://localhost",
      ],
    ])("rejects %s", async (label, authorization, origin) => {
      const env = label === "an unlisted native origin" ? environment : native;
      await expect(
        verifyBearerSession(authorization, env, origin, verifier),
      ).resolves.toBeNull();
    });

    it("keeps native origins out of hosted environments", () => {
      expect(() =>
        readServerEnvironment({
          APP_ENV: "production",
          CLIENT_ORIGINS: "https://app.example.com,capacitor://localhost",
        }),
      ).toThrow("CLIENT_ORIGINS");
    });
  });

  it("rejects all bearer tokens when auth is disabled", async () => {
    await expect(
      verifyBearerSession(
        `Bearer ${token()}`,
        { ...environment, AUTH_ENABLED: false },
        null,
        verifier,
      ),
    ).resolves.toBeNull();
  });
});
