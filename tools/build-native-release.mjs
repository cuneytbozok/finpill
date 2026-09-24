/* global fetch, AbortSignal */
import { spawnSync } from "node:child_process";
import console from "node:console";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { platform } from "node:os";
import { resolve } from "node:path";
import process from "node:process";
import { URL } from "node:url";

const profile = process.argv[2];
const apiOrigin = process.env.FINPILL_API_ORIGIN;
const publishableKey = process.env.FINPILL_CLERK_PUBLISHABLE_KEY;
if (profile !== "staging" && profile !== "production") {
  throw new Error("Choose staging or production as the native build profile");
}
if (platform() !== "darwin") {
  throw new Error("The native build pipeline requires macOS and Xcode");
}
let origin;
try {
  origin = new URL(apiOrigin);
} catch {
  throw new Error("FINPILL_API_ORIGIN must be an HTTPS origin");
}
if (
  origin.protocol !== "https:" ||
  origin.origin !== apiOrigin ||
  origin.hostname === "localhost"
) {
  throw new Error("FINPILL_API_ORIGIN must be an HTTPS origin");
}
const keyPrefix = profile === "production" ? "pk_live_" : "pk_test_";
if (!publishableKey?.startsWith(keyPrefix)) {
  throw new Error("FINPILL_CLERK_PUBLISHABLE_KEY has the wrong profile");
}

const healthResponse = await fetch(new URL("/api/v1/health", origin), {
  signal: AbortSignal.timeout(10_000),
  cache: "no-store",
});
if (!healthResponse.ok) {
  throw new Error(`API health returned ${healthResponse.status}`);
}
const health = await healthResponse.json();
if (health.status !== "ok" || health.apiVersion !== "v1") {
  throw new Error("The API does not provide the required v1 health contract");
}

const appEnvironment = profile;
const buildEnvironment = {
  ...process.env,
  NEXT_PUBLIC_APP_ENV: appEnvironment,
  NEXT_PUBLIC_API_ENABLED: "true",
  NEXT_PUBLIC_API_ORIGIN: apiOrigin,
  NEXT_PUBLIC_AUTH_ENABLED: "true",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publishableKey,
};
function run(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, {
    cwd,
    env: buildEnvironment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}`);
  }
}

run("npm", ["run", "native:sync"]);
run("xcodebuild", [
  "-project",
  "apps/client/ios/App/App.xcodeproj",
  "-scheme",
  "App",
  "-configuration",
  "Release",
  "-sdk",
  "iphonesimulator",
  "-destination",
  "generic/platform=iOS Simulator",
  "-derivedDataPath",
  "build/DerivedData",
  "-quiet",
  "CODE_SIGNING_ALLOWED=NO",
  "build",
]);
run("./gradlew", [":app:assembleRelease"], resolve("apps/client/android"));

const artifact = await readFile("apps/client/out/index.html");
const revision = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
});
if (revision.status !== 0) throw new Error("Unable to read source revision");
const release = {
  profile,
  apiOrigin,
  apiVersion: health.apiVersion,
  gitRevision: revision.stdout.trim(),
  staticIndexSha256: createHash("sha256").update(artifact).digest("hex"),
  iosBuild: "unsigned Release simulator",
  androidBuild: "unsigned Release APK",
};
await mkdir("build/native-release", { recursive: true });
await writeFile(
  `build/native-release/${profile}.json`,
  `${JSON.stringify(release, null, 2)}\n`,
);
console.log(`Native ${profile} build verified against API v1`);
