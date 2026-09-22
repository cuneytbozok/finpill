/* global fetch */
import process from "node:process";
import console from "node:console";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const next = path.join(root, "node_modules/next/dist/bin/next");
// Generated test-only values; these never authenticate to any service.
const canaries = {
  CLERK_SECRET_KEY: `sk_live_${randomUUID()}`,
  SUPABASE_SECRET_KEY: `sb_secret_${randomUUID()}`,
  KAP_API_SECRET: `FINPILL_TEST_${randomUUID()}`,
};
const env = {
  ...process.env,
  ...canaries,
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_VERCEL_ENV: "preview",
  NEXT_PUBLIC_VERCEL_URL: "finpill-build-check.vercel.app",
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: "test-build-sha",
  NEXT_PUBLIC_APP_ENV: "production",
  NEXT_PUBLIC_API_ORIGIN: "https://api.build-check.example.com",
  NEXT_PUBLIC_AUTH_ENABLED: "false",
  APP_ENV: "production",
  CLIENT_ORIGINS: "https://app.build-check.example.com",
  AUTH_ENABLED: "false",
  DATABASE_ENABLED: "false",
  PRIVILEGED_DATA_ENABLED: "false",
  KAP_ENABLED: "false",
};
function build(app, overrides = {}, succeeds = true) {
  const result = spawnSync(process.execPath, [next, "build"], {
    cwd: path.join(root, "apps", app),
    env: { ...env, ...overrides },
    encoding: "utf8",
    timeout: 120_000,
  });
  const output = result.stdout + result.stderr;
  for (const value of Object.values(canaries))
    assert(!output.includes(value), "Build output leaked a secret canary");
  if (succeeds) assert.equal(result.status, 0, output);
  else {
    assert.notEqual(
      result.status,
      0,
      "Invalid configuration unexpectedly built",
    );
    assert.match(
      output,
      /environment configuration|public environment allowlist/,
    );
  }
}

build("client", { NEXT_PUBLIC_API_ORIGIN: "" }, false);
build("client", { NEXT_PUBLIC_KAP_API_SECRET: "forbidden" }, false);
build("api", { APP_ENV: "" }, false);
build("client");

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? files(target) : [target];
      }),
    )
  ).flat();
}
let foundPublicOrigin = false;
const artifacts = await files(path.join(root, "apps/client/out"));
for (const file of artifacts) {
  const contents = await readFile(file, "utf8");
  for (const value of Object.values(canaries))
    assert(!contents.includes(value), "Static artifact leaked a secret canary");
  if (file.endsWith(".js") && contents.includes(env.NEXT_PUBLIC_API_ORIGIN))
    foundPublicOrigin = true;
}
assert(foundPublicOrigin, "Public API origin was not inlined into browser JS");
build("api");

// Use an ephemeral port to avoid interfering with another worktree's server.
const probe = createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
async function start(overrides, shouldStart) {
  const child = spawn(
    process.execPath,
    [next, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: path.join(root, "apps/api"),
      env: { ...env, ...overrides },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    output += data;
  });
  const exited = new Promise((resolve) => child.once("exit", resolve));
  try {
    if (!shouldStart) {
      const status = await Promise.race([
        exited,
        setTimeout(15_000, "timeout"),
      ]);
      assert.notEqual(
        status,
        "timeout",
        "Invalid runtime settings did not stop startup",
      );
      assert.notEqual(status, 0);
      assert.match(output, /Invalid environment configuration/);
    } else {
      let response;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null)
          throw new Error("Production server exited before readiness");
        try {
          response = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
          if (response.ok) break;
        } catch {
          /* Poll startup. */
        }
        await setTimeout(100);
      }
      assert(response?.ok, "Production server failed to start");
      assert.deepEqual(await response.json(), {
        status: "ok",
        apiVersion: "v1",
      });
    }
    for (const value of Object.values(canaries))
      assert(!output.includes(value), "Runtime output leaked a secret canary");
  } finally {
    if (child.exitCode === null) child.kill("SIGTERM");
    await exited;
  }
}
await start({}, true);
await start({ APP_ENV: "" }, false);
console.log(
  `Environment build checks passed: rejected invalid builds/runtime, verified production liveness and scanned ${artifacts.length} static files.`,
);
