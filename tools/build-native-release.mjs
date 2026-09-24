/* global fetch, AbortSignal */
import { spawnSync } from "node:child_process";
import console from "node:console";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { platform, tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import {
  releaseBuildEnvironment,
  releaseSettings,
  scanForCredentials,
  treeSha256,
} from "./native-release.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const profile = process.argv[2];
const settings = releaseSettings(profile, process.env);
if (platform() !== "darwin")
  throw new Error("The native release build requires macOS and Xcode");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} failed with exit code ${result.status}`);
  return result;
}
function output(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} failed`);
  return result.stdout.trim();
}

// A release is reproducible only from committed source and explicit settings.
if (output("git", ["status", "--porcelain", "--untracked-files=normal"]))
  throw new Error(
    "Commit or remove working-tree changes before a release build",
  );
const clientDirectory = path.join(root, "apps/client");
const envFiles = (await readdir(clientDirectory)).filter(
  (name) => name.startsWith(".env") && name !== ".env.example",
);
if (envFiles.length > 0)
  throw new Error(
    `Remove client environment files before a release build: ${envFiles.join(", ")}`,
  );

const healthResponse = await fetch(
  new URL("/api/v1/health", settings.NEXT_PUBLIC_API_ORIGIN),
  { signal: AbortSignal.timeout(10_000), cache: "no-store" },
);
if (!healthResponse.ok)
  throw new Error(`API health returned ${healthResponse.status}`);
const health = await healthResponse.json();
if (health.status !== "ok" || health.apiVersion !== "v1")
  throw new Error("The API does not provide the required v1 health contract");

const env = releaseBuildEnvironment(process.env, settings);
run("npm", ["run", "native:sync"], { env });
const derivedData = path.join(root, "build/native-release/DerivedData");
run(
  "xcodebuild",
  [
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
    derivedData,
    "-quiet",
    "CODE_SIGNING_ALLOWED=NO",
    "build",
  ],
  { env },
);
run("./gradlew", [":app:assembleRelease"], {
  cwd: path.join(clientDirectory, "android"),
  env,
});

const iosApp = path.join(
  derivedData,
  "Build/Products/Release-iphonesimulator/App.app",
);
const apk = path.join(
  clientDirectory,
  "android/app/build/outputs/apk/release/app-release-unsigned.apk",
);
for (const artifact of [iosApp, apk])
  if (!existsSync(artifact)) throw new Error(`Missing artifact: ${artifact}`);

// Inspect the packaged artifacts themselves, not only the synced sources.
const extracted = await mkdtemp(path.join(tmpdir(), "finpill-release-"));
try {
  run("unzip", ["-q", apk, "-d", extracted]);
  run("node", [
    "tools/check-native-assets.mjs",
    iosApp,
    path.join(extracted, "assets"),
  ]);
  const serverValues = [
    "CLERK_SECRET_KEY",
    "SUPABASE_SECRET_KEY",
    "KAP_API_SECRET",
  ]
    .map((name) => process.env[name])
    .filter(Boolean);
  const findings = [
    ...(await scanForCredentials(iosApp, serverValues)).map((f) => `ios:${f}`),
    ...(await scanForCredentials(extracted, serverValues)).map(
      (f) => `android:${f}`,
    ),
  ];
  if (findings.length > 0)
    throw new Error(`Credential pattern in artifacts: ${findings.join(", ")}`);
} finally {
  await rm(extracted, { recursive: true, force: true });
}

const manifest = {
  profile,
  appEnvironment: settings.NEXT_PUBLIC_APP_ENV,
  apiOrigin: settings.NEXT_PUBLIC_API_ORIGIN,
  apiVersion: health.apiVersion,
  authEnabled: settings.NEXT_PUBLIC_AUTH_ENABLED === "true",
  deepLinkOrigin: settings.NEXT_PUBLIC_DEEP_LINK_ORIGIN ?? null,
  sourceRevision: output("git", ["rev-parse", "HEAD"]),
  toolchain: {
    node: process.version,
    xcode: output("xcodebuild", ["-version"]).split("\n").join(" "),
  },
  artifacts: {
    staticClientSha256: await treeSha256(path.join(clientDirectory, "out")),
    ios: {
      kind: "unsigned Release simulator app",
      sha256: await treeSha256(iosApp),
    },
    android: {
      kind: "unsigned Release APK",
      sha256: createHash("sha256")
        .update(await readFile(apk))
        .digest("hex"),
    },
  },
  secretScan: "passed",
};
await mkdir(path.join(root, "build/native-release"), { recursive: true });
const manifestPath = path.join(root, `build/native-release/${profile}.json`);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Native ${profile} release built and scanned: ${manifestPath}`);
