import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { URL } from "node:url";

// Release profiles describe what an installable build targets. Only the
// Production application exists; a Local profile belongs to local builds.
export const releaseProfiles = {
  production: { appEnvironment: "production", clerkKeyPrefix: "pk_live_" },
};

function hostedOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  return (
    url.protocol === "https:" &&
    url.origin === value &&
    host.includes(".") &&
    !(
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.startsWith("[") ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host)
    )
  );
}

// Returns the complete public client settings for a release; never a secret.
export function releaseSettings(profileName, input) {
  const profile = Object.hasOwn(releaseProfiles, profileName)
    ? releaseProfiles[profileName]
    : undefined;
  if (!profile)
    throw new Error(
      `Choose a release profile: ${Object.keys(releaseProfiles).join(", ")}`,
    );
  if (!hostedOrigin(input.FINPILL_API_ORIGIN ?? ""))
    throw new Error("FINPILL_API_ORIGIN must be a hosted HTTPS origin");
  const key = input.FINPILL_CLERK_PUBLISHABLE_KEY;
  if (
    key !== undefined &&
    (!key.startsWith(profile.clerkKeyPrefix) ||
      key.length <= profile.clerkKeyPrefix.length)
  )
    throw new Error(
      `FINPILL_CLERK_PUBLISHABLE_KEY must be a ${profile.clerkKeyPrefix} key for this profile`,
    );
  const deepLink = input.FINPILL_DEEP_LINK_ORIGIN;
  if (deepLink !== undefined && !hostedOrigin(deepLink))
    throw new Error("FINPILL_DEEP_LINK_ORIGIN must be a hosted HTTPS origin");
  return {
    NEXT_PUBLIC_APP_ENV: profile.appEnvironment,
    NEXT_PUBLIC_API_ENABLED: "true",
    NEXT_PUBLIC_API_ORIGIN: input.FINPILL_API_ORIGIN,
    NEXT_PUBLIC_AUTH_ENABLED: key ? "true" : "false",
    ...(key ? { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: key } : {}),
    ...(deepLink ? { NEXT_PUBLIC_DEEP_LINK_ORIGIN: deepLink } : {}),
  };
}

// Inherited settings that must not reach a release build: application
// settings come only from the profile, and server/provider names are dropped.
const inheritedName =
  /^(?:NEXT_PUBLIC_|APP_ENV$|CLIENT_ORIGINS$|CLERK_|SUPABASE_|KAP_|DATABASE_URL$|POSTGRES_|PG(?:HOST|USER|PASSWORD|DATABASE|PORT)$)|(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|CREDENTIALS?)(?:_|$)/;
export function releaseBuildEnvironment(source, settings) {
  const env = {};
  for (const [key, value] of Object.entries(source))
    if (!inheritedName.test(key)) env[key] = value;
  return { ...env, NEXT_TELEMETRY_DISABLED: "1", ...settings };
}

// Credential shapes that must never appear in a packaged artifact.
export const credentialPattern =
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bsb_secret_[A-Za-z0-9_-]{8,}|\bsk_(?:live|test)_[A-Za-z0-9]{8,}|\bpk_test_[A-Za-z0-9]{8,}/;

export async function files(directory, prefix = "") {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await files(absolute, relative)));
    else if (entry.isFile()) found.push([relative, absolute]);
  }
  return found.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export function containsCredential(bytes, extraValues = []) {
  const text = bytes.toString("latin1");
  return (
    credentialPattern.test(text) ||
    extraValues.some((value) => value && text.includes(value))
  );
}

// Scans every file and returns only the paths that match, never the match.
export async function scanForCredentials(directory, extraValues = []) {
  const findings = [];
  for (const [relative, absolute] of await files(directory))
    if (containsCredential(await readFile(absolute), extraValues))
      findings.push(relative);
  return findings;
}

// A content hash for a directory artifact such as an .app bundle.
export async function treeSha256(directory) {
  const tree = createHash("sha256");
  for (const [relative, absolute] of await files(directory)) {
    const digest = createHash("sha256")
      .update(await readFile(absolute))
      .digest("hex");
    tree.update(`${relative}\0${digest}\n`);
  }
  return tree.digest("hex");
}
