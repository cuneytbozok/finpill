import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import console from "node:console";
import process from "node:process";

const client = fileURLToPath(new URL("../apps/client/", import.meta.url));
const config = JSON.parse(
  await readFile(path.join(client, "capacitor.config.json"), "utf8"),
);
assert.equal(config.appId, "com.cuneytbozok.finpill");
assert.equal(config.webDir, "out");
assert.equal(
  config.server,
  undefined,
  "Remote shell/server overrides are forbidden",
);
for (const platform of ["ios", "android"]) {
  assert.equal(config[platform].webContentsDebuggingEnabled, false);
}
const forbiddenNames =
  /^(?:\.next|\.env(?:\..*)?|node_modules|server|.*\.(?:map|pem|key|p12|p8|jks|keystore|mobileprovision))$/i;
const forbiddenContent =
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|sb_secret_[A-Za-z0-9_-]+|sk_live_[A-Za-z0-9]+/;
const secretNames = [
  "CLERK_SECRET_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "KAP_API_SECRET",
];
async function inventory(directory, prefix = "") {
  const files = new Map();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    assert(
      !forbiddenNames.test(entry.name),
      `Forbidden native asset: ${relative}`,
    );
    assert(!entry.isSymbolicLink(), `Symlink in native assets: ${relative}`);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const pair of await inventory(absolute, relative))
        files.set(...pair);
    } else {
      const bytes = await readFile(absolute);
      const text = bytes.toString("utf8");
      assert(!forbiddenContent.test(text), `Credential pattern in ${relative}`);
      for (const name of secretNames) {
        const value = process.env[name];
        assert(
          !value || !text.includes(value),
          `Secret value found in ${relative}`,
        );
      }
      files.set(relative, createHash("sha256").update(bytes).digest("hex"));
    }
  }
  return files;
}
const exported = await inventory(path.join(client, "out"));
assert(exported.has("index.html"), "Missing static entry");
assert(
  [...exported.keys()].some(
    (name) => name.startsWith("_next/static/") && name.endsWith(".js"),
  ),
  "Missing executable client assets",
);
// Optional arguments inspect extracted .app or APK assets, not just sync staging.
const targets = process.argv.slice(2);
if (targets.length === 0)
  targets.push(
    path.join(client, "ios/App/App"),
    path.join(client, "android/app/src/main/assets"),
  );
for (const target of targets) {
  const packagedConfig = JSON.parse(
    await readFile(path.join(target, "capacitor.config.json"), "utf8"),
  );
  if ("packageClassList" in packagedConfig) {
    assert.deepEqual(packagedConfig.packageClassList, ["AppPlugin"]);
    delete packagedConfig.packageClassList;
  }
  assert.deepEqual(packagedConfig, config, `Configuration drift: ${target}`);
  const packaged = await inventory(path.join(target, "public"));
  for (const [name, hash] of exported) {
    // Android packaging omits dot-prefixed paths (aapt ignoreAssetsPattern),
    // such as web-only .well-known files; anything packaged must still match.
    if (
      !packaged.has(name) &&
      name.split("/").some((segment) => segment.startsWith("."))
    )
      continue;
    assert.equal(
      packaged.get(name),
      hash,
      `Missing or stale bundled asset: ${name}`,
    );
  }
  for (const name of packaged.keys()) {
    assert(
      exported.has(name) || ["cordova.js", "cordova_plugins.js"].includes(name),
      `Unexpected bundled asset: ${name}`,
    );
  }
  console.log(
    `Verified ${exported.size} static assets and native configuration: ${target}`,
  );
}
