import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  releaseBuildEnvironment,
  releaseSettings,
  scanForCredentials,
  treeSha256,
} from "../tools/native-release.mjs";

const api = { FINPILL_API_ORIGIN: "https://api.example.com" };

describe("native release profile", () => {
  it("targets Production with API on and auth only when a live key is given", () => {
    expect(releaseSettings("production", api)).toEqual({
      NEXT_PUBLIC_APP_ENV: "production",
      NEXT_PUBLIC_API_ENABLED: "true",
      NEXT_PUBLIC_API_ORIGIN: "https://api.example.com",
      NEXT_PUBLIC_AUTH_ENABLED: "false",
    });
    expect(
      releaseSettings("production", {
        ...api,
        FINPILL_CLERK_PUBLISHABLE_KEY: "pk_live_fake",
      }).NEXT_PUBLIC_AUTH_ENABLED,
    ).toBe("true");
  });
  it.each(["staging", "local", "preview", "", undefined, "__proto__"])(
    "rejects unknown profile %s",
    (profile) => {
      expect(() => releaseSettings(profile, api)).toThrow("release profile");
    },
  );
  it.each([
    undefined,
    "http://api.example.com",
    "https://localhost",
    "https://192.168.1.2",
    "https://api.example.com/",
    "https://api.example.com/v1",
    "https://intranet",
  ])("rejects non-hosted API origin %s", (origin) => {
    expect(() =>
      releaseSettings("production", { FINPILL_API_ORIGIN: origin }),
    ).toThrow("FINPILL_API_ORIGIN");
  });
  it.each(["pk_test_fake", "sk_live_fake", "pk_live_", ""])(
    "rejects publishable key %s for Production",
    (key) => {
      expect(() =>
        releaseSettings("production", {
          ...api,
          FINPILL_CLERK_PUBLISHABLE_KEY: key,
        }),
      ).toThrow("FINPILL_CLERK_PUBLISHABLE_KEY");
    },
  );
  it("drops inherited application, server and provider settings", () => {
    const env = releaseBuildEnvironment(
      {
        PATH: "/bin",
        JAVA_HOME: "/jdk",
        NEXT_PUBLIC_API_ORIGIN: "http://localhost:3001",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fake",
        APP_ENV: "local",
        CLERK_SECRET_KEY: "sk_test_fake",
        SUPABASE_SECRET_KEY: "sb_secret_fake",
        DATABASE_URL: "postgres://x",
        GITHUB_TOKEN: "x",
        OPENAI_API_KEY: "x",
      },
      releaseSettings("production", api),
    );
    expect(env).toEqual({
      PATH: "/bin",
      JAVA_HOME: "/jdk",
      NEXT_TELEMETRY_DISABLED: "1",
      ...releaseSettings("production", api),
    });
  });
});

describe("native artifact inspection", () => {
  const directories = [];
  async function artifact(contents) {
    const directory = await mkdtemp(path.join(tmpdir(), "finpill-artifact-"));
    directories.push(directory);
    for (const [name, value] of Object.entries(contents)) {
      await mkdir(path.dirname(path.join(directory, name)), {
        recursive: true,
      });
      await writeFile(path.join(directory, name), value);
    }
    return directory;
  }
  afterAll(async () => {
    for (const directory of directories)
      await rm(directory, { recursive: true, force: true });
  });

  it("reports credential paths without values", async () => {
    const directory = await artifact({
      "public/index.html": "<html>pk_live_publicvalue</html>",
      "public/a.js": 'const k="sk_live_abcdefgh1234"',
      "public/b.js": 'const k="sb_secret_abcdefgh1234"',
      "public/c.js": 'const k="pk_test_abcdefgh1234"',
      "nested/key.txt": "-----BEGIN PRIVATE KEY-----",
      "nested/canary.txt": "server-canary-value",
    });
    const findings = await scanForCredentials(directory, [
      "server-canary-value",
    ]);
    expect(findings).toEqual([
      "nested/canary.txt",
      "nested/key.txt",
      "public/a.js",
      "public/b.js",
      "public/c.js",
    ]);
    expect(findings.join()).not.toContain("abcdefgh");
  });
  it("hashes directory artifacts by path and content", async () => {
    const a = await artifact({ "x/1.txt": "one", "2.txt": "two" });
    const b = await artifact({ "2.txt": "two", "x/1.txt": "one" });
    const c = await artifact({ "x/1.txt": "one", "3.txt": "two" });
    expect(await treeSha256(a)).toBe(await treeSha256(b));
    expect(await treeSha256(a)).not.toBe(await treeSha256(c));
  });
});
