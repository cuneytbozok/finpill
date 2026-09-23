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
      verifyBearerSession(`Bearer ${token()}`, environment, verifier),
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
      verifyBearerSession(authorization, environment, verifier),
    ).resolves.toBeNull();
  });

  it("rejects all bearer tokens when auth is disabled", async () => {
    await expect(
      verifyBearerSession(
        `Bearer ${token()}`,
        { ...environment, AUTH_ENABLED: false },
        verifier,
      ),
    ).resolves.toBeNull();
  });
});
