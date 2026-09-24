// KAP fixture evidence tooling for task 02.01.
//
// Real KAP payloads are retrieved from the MKK development API only and stored
// byte-for-byte under an ignored directory. Git holds the manifest: origin,
// retrieval time, SHA-256, rights, coverage and independently checked
// expectations. Credentials come from the API's ignored Local env file
// (apps/api/.env.local, or KAP_ENV_FILE) and are never printed; errors carry
// the HTTP status only. KAP_ENABLED may stay false there: this tool does not
// enable KAP in the API runtime.
//
// Usage (Node 24):
//   node tools/kap-fixtures.mjs get <apiPath> <scratchName> [--allow-error]
//   node tools/kap-fixtures.mjs promote <scratchName> <fixtureId> <cohortCode|-> <tag,tag,...>
//   node tools/kap-fixtures.mjs verify [--require-payloads]

import { Buffer } from "node:buffer";
import console from "node:console";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, URL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const fixtureDir = join(root, "tests/fixtures/kap");
export const manifestPath = join(fixtureDir, "manifest.json");
export const payloadDir = join(fixtureDir, "payloads");
const envFile = process.env.KAP_ENV_FILE ?? join(root, "apps/api/.env.local");

export const DEVELOPMENT_HOST = "apigwdev.mkk.com.tr";
export const DEVELOPMENT_BASE_PATH = "/api/vyk";

// Only the read-only GET endpoints of the MKK development VYK specification
// are retrievable. generateToken (production auth) is deliberately absent.
const allowedPaths = [
  /^\/members$/,
  /^\/memberSecurities$/,
  /^\/memberDetail\/[A-Za-z0-9]+$/,
  /^\/funds(?:\?[A-Za-z0-9=&,_-]+)?$/,
  /^\/fundDetail\/[A-Za-z0-9]+$/,
  /^\/caEventStatus\?processRefId=[A-Za-z0-9,_-]+$/,
  /^\/blockedDisclosures$/,
  /^\/lastDisclosureIndex$/,
  /^\/disclosures\?[A-Za-z0-9=&,_-]+$/,
  /^\/disclosureDetail\/\d+\?[A-Za-z0-9=&,_-]+$/,
  /^\/downloadAttachment\/[0-9a-f]{32}$/,
];

export const COVERAGE_TAGS = new Set([
  "directory",
  "disclosure-list",
  "financial-report",
  "non-financial-disclosure",
  "industrial",
  "bank",
  "insurance",
  "leasing-factoring",
  "real-estate-investment-trust",
  "holding",
  "consolidated",
  "standalone",
  "non-december-fiscal-year",
  "restatement",
  "tms-29",
  "dimensional-facts",
  "negative-values",
  "missing-values",
  "single-context",
  "single-value",
  "single-report-item",
  "single-lang",
  "foreign-currency-presentation",
  "attachment",
  "error-response",
]);

// Structured tags name what a fixture covers without a closed vocabulary:
// disclosure class/type, subreport template, taxonomy family, representation.
const structuredTag =
  /^(?:endpoint|class|type|template|family|representation|rounding|reason|event|dto):[A-Za-z0-9._-]+$/;
export const isCoverageTag = (tag) =>
  COVERAGE_TAGS.has(tag) || structuredTag.test(tag);

// Payload file names derive from the recorded content type.
export function payloadExtension(contentType = "") {
  if (/json/i.test(contentType)) return ".json";
  if (/pdf/i.test(contentType)) return ".pdf";
  if (/html/i.test(contentType)) return ".html";
  return ".bin";
}
export const payloadFile = (fixture) =>
  `${fixture.id}${payloadExtension(fixture.contentType)}`;

export const RIGHTS = Object.freeze({
  basis: "owner-mkk-development-account",
  use: "private-development-testing",
  redistribution: "not-permitted",
  storage: "local-ignored",
});

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function fixtureConfig(env) {
  if (env.KAP_ENV !== "development" || env.KAP_AUTH_MODE !== "basic")
    throw new Error(
      "Fixture retrieval requires KAP_ENV=development and KAP_AUTH_MODE=basic",
    );
  let base;
  try {
    base = new URL(env.KAP_BASE_URL ?? "");
  } catch {
    throw new Error("KAP_BASE_URL is missing or invalid");
  }
  if (
    base.protocol !== "https:" ||
    base.hostname.toLowerCase().replace(/\.$/, "") !== DEVELOPMENT_HOST ||
    base.port ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname.replace(/\/$/, "") !== DEVELOPMENT_BASE_PATH
  ) {
    throw new Error(
      `Fixture retrieval is limited to https://${DEVELOPMENT_HOST}${DEVELOPMENT_BASE_PATH}`,
    );
  }
  if (!env.KAP_API_KEY || !env.KAP_API_SECRET) {
    throw new Error("KAP_API_KEY and KAP_API_SECRET are required");
  }
  return {
    base: `https://${DEVELOPMENT_HOST}${DEVELOPMENT_BASE_PATH}`,
    authorization: `Basic ${Buffer.from(`${env.KAP_API_KEY}:${env.KAP_API_SECRET}`).toString("base64")}`,
  };
}

export function checkApiPath(apiPath) {
  if (typeof apiPath !== "string" || !allowedPaths.some((p) => p.test(apiPath)))
    throw new Error(`API path is not an allowed read-only VYK endpoint`);
  return apiPath;
}

// The free MKK development plan allows 6 calls per minute. Stay at 5 per
// rolling 60 s, tracked across runs in the ignored payload directory.
export const RATE_LIMIT = { calls: 5, windowMs: 60_000 };

export function throttleDelay(history, now, limit = RATE_LIMIT) {
  const recent = history.filter((t) => now - t < limit.windowMs);
  if (recent.length < limit.calls) return 0;
  return recent[recent.length - limit.calls] + limit.windowMs - now + 250;
}

const rateFile = join(payloadDir, ".rate.json");
async function throttle() {
  let history;
  try {
    history = JSON.parse(readFileSync(rateFile, "utf8"));
  } catch {
    history = [];
  }
  const wait = throttleDelay(history, Date.now());
  if (wait > 0) {
    console.error(`throttle: waiting ${Math.ceil(wait / 1000)} s`);
    await sleep(wait);
  }
  const now = Date.now();
  mkdirSync(payloadDir, { recursive: true });
  writeFileSync(
    rateFile,
    JSON.stringify([...history.filter((t) => now - t < 60_000), now]),
  );
}

export async function retrieve(
  config,
  apiPath,
  fetcher = globalThis.fetch,
  wait = throttle,
  { allowError = false } = {},
) {
  const url = `${config.base}${checkApiPath(apiPath)}`;
  await wait();
  const response = await fetcher(url, {
    headers: {
      Accept: "application/json",
      Authorization: config.authorization,
    },
    redirect: "error",
    signal: globalThis.AbortSignal.timeout(60_000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok && !allowError)
    throw new Error(`KAP request failed with HTTP ${response.status}`);
  return {
    status: response.status,
    bytes,
    retrievedAt: new Date().toISOString(),
    contentType: response.headers.get("content-type") ?? "unknown",
  };
}

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const decimalPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export function validateManifest(manifest) {
  const errors = [];
  const fail = (where, message) => errors.push(`${where}: ${message}`);
  if (manifest?.schemaVersion !== 1)
    fail("manifest", "schemaVersion must be 1");
  const spec = manifest?.specification;
  if (
    spec &&
    (!spec.title || !spec.version || !/^[0-9a-f]{64}$/.test(spec.sha256 ?? ""))
  )
    fail("specification", "needs title, version and sha256");
  const fixtures = Array.isArray(manifest?.fixtures) ? manifest.fixtures : [];
  if (!Array.isArray(manifest?.fixtures))
    fail("manifest", "fixtures must be an array");
  const seen = new Set();
  const checked = [];
  for (const [i, f] of fixtures.entries()) {
    const at = `fixtures[${i}]${f?.id ? ` (${f.id})` : ""}`;
    if (!idPattern.test(f?.id ?? "")) fail(at, "id must be kebab-case");
    else if (seen.has(f.id)) fail(at, "duplicate id");
    seen.add(f?.id);
    if (f?.origin?.environment !== "mkk-development")
      fail(at, "origin.environment must be mkk-development");
    if (f?.origin?.host !== DEVELOPMENT_HOST) fail(at, "origin.host mismatch");
    try {
      checkApiPath(f?.origin?.path);
    } catch {
      fail(at, "origin.path is not an allowed endpoint");
    }
    if (
      typeof f?.retrievedAt !== "string" ||
      Number.isNaN(Date.parse(f.retrievedAt)) ||
      new Date(f.retrievedAt).toISOString() !== f.retrievedAt
    )
      fail(at, "retrievedAt must be an ISO-8601 UTC timestamp");
    if (!/^[0-9a-f]{64}$/.test(f?.sha256 ?? ""))
      fail(at, "sha256 must be 64 hex chars");
    if (
      !Number.isInteger(f?.httpStatus) ||
      f.httpStatus < 200 ||
      f.httpStatus > 599
    )
      fail(at, "httpStatus must be an HTTP status code");
    if (f.httpStatus >= 300 && !f.coverage?.includes("error-response"))
      fail(at, "non-2xx fixtures must be tagged error-response");
    if (!Number.isSafeInteger(f?.byteLength) || f.byteLength <= 0)
      fail(at, "byteLength must be a positive integer");
    for (const [key, value] of Object.entries(RIGHTS))
      if (f?.rights?.[key] !== value)
        fail(at, `rights.${key} must be ${value}`);
    if (!Array.isArray(f?.coverage) || f.coverage.length === 0)
      fail(at, "coverage must list at least one tag");
    else
      for (const tag of f.coverage)
        if (!isCoverageTag(tag)) fail(at, `unknown coverage tag ${tag}`);
    for (const [j, e] of (f?.expectations ?? []).entries()) {
      const eat = `${at} expectations[${j}]`;
      if (!e?.locator || typeof e.locator !== "object")
        fail(eat, "locator required");
      for (const key of ["value", "independentValue"])
        if (typeof e?.[key] !== "string" || !decimalPattern.test(e[key]))
          fail(eat, `${key} must be an exact decimal string`);
      if (
        !e?.checkedAgainst?.fixture ||
        typeof e.checkedAgainst.location !== "string"
      )
        fail(eat, "checkedAgainst needs {fixture, location}");
      else checked.push([eat, e.checkedAgainst.fixture, f.id]);
      // A disagreement between the payload and its independent source is
      // evidence to preserve, never something to repair in the fixture.
      if (e?.agrees !== (e?.value === e?.independentValue))
        fail(eat, "agrees must state whether value equals independentValue");
    }
  }
  for (const [eat, source, self] of checked)
    if (source === self || !seen.has(source))
      fail(eat, `checkedAgainst.fixture ${source} must be another fixture`);
  const cohort = manifest?.cohort ?? [];
  const codes = new Set();
  for (const [i, c] of cohort.entries()) {
    if (!/^[A-Z0-9]{3,6}$/.test(c?.stockCode ?? ""))
      fail(`cohort[${i}]`, "stockCode");
    if (codes.has(c?.stockCode)) fail(`cohort[${i}]`, "duplicate stockCode");
    codes.add(c?.stockCode);
    if (!c?.reason) fail(`cohort[${i}]`, "reason required");
  }
  for (const f of fixtures)
    if (f?.cohortCode && !codes.has(f.cohortCode))
      fail(f.id, `cohortCode ${f.cohortCode} is not in the cohort`);
  return errors;
}

const arrayify = (value) =>
  value == null ? [] : Array.isArray(value) ? value : [value];

// Resolves an expectation locator inside a disclosureDetail `presentation`
// payload. Cardinality is normalized; the measure set must match exactly.
export function locateValues(detail, locator) {
  const found = [];
  const want = Object.entries(locator.measure ?? {}).sort();
  const visit = (items) => {
    for (const item of arrayify(items)) {
      if (
        item.name === locator.concept &&
        (locator.preferredLabel === undefined ||
          item.preferredLabel === locator.preferredLabel)
      )
        for (const value of arrayify(item.Values?.Value)) {
          const got = arrayify(value.Measures?.Measure)
            .map((m) => [m.measureName, m.measureValueName])
            .sort();
          if (
            value.contextId === locator.contextId &&
            JSON.stringify(got) === JSON.stringify(want)
          )
            found.push(value.value);
        }
      visit(item.ReportItem);
    }
  };
  for (const sub of arrayify(detail.presentation))
    if (sub.id === locator.subReport) visit(sub.content?.ReportItem);
  return found;
}

export function checkExpectations(
  manifest,
  dir = payloadDir,
  read = readFileSync,
) {
  const results = [];
  for (const f of manifest.fixtures) {
    if (!f.expectations?.length) continue;
    let detail;
    try {
      detail = JSON.parse(read(join(dir, payloadFile(f)), "utf8"));
    } catch {
      results.push({ id: f.id, status: "missing" });
      continue;
    }
    for (const [i, e] of f.expectations.entries()) {
      const found = locateValues(detail, e.locator);
      const status =
        found.length !== 1
          ? `ambiguous(${found.length})`
          : found[0] === e.value
            ? "verified"
            : "mismatch";
      results.push({ id: `${f.id}#${i}`, status });
    }
  }
  return results;
}

export function verifyPayloads(
  manifest,
  dir = payloadDir,
  read = readFileSync,
) {
  return manifest.fixtures.map((f) => {
    const file = join(dir, payloadFile(f));
    let bytes;
    try {
      bytes = read(file);
    } catch {
      return { id: f.id, status: "missing" };
    }
    const ok = bytes.length === f.byteLength && sha256(bytes) === f.sha256;
    return { id: f.id, status: ok ? "verified" : "mismatch" };
  });
}

function readEnvFile() {
  if (!existsSync(envFile)) throw new Error(`${envFile} is missing`);
  const env = {};
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return env;
}

const readManifest = () => JSON.parse(readFileSync(manifestPath, "utf8"));
const writeManifest = (m) =>
  writeFileSync(manifestPath, `${JSON.stringify(m, null, 2)}\n`);

async function main([command, ...args]) {
  const scratch = join(payloadDir, "scratch");
  if (command === "get") {
    const [apiPath, name, flag] = args;
    if (!idPattern.test(name ?? ""))
      throw new Error("usage: get <apiPath> <scratchName> [--allow-error]");
    const r = await retrieve(
      fixtureConfig(readEnvFile()),
      apiPath,
      undefined,
      undefined,
      {
        allowError: flag === "--allow-error",
      },
    );
    // Exploration output stays inside the ignored payload directory, with the
    // retrieval metadata needed to promote it without another API call.
    mkdirSync(scratch, { recursive: true });
    writeFileSync(join(scratch, name), r.bytes);
    writeFileSync(
      join(scratch, `${name}.meta.json`),
      JSON.stringify({
        path: apiPath,
        retrievedAt: r.retrievedAt,
        contentType: r.contentType,
        status: r.status,
      }),
    );
    console.log(
      JSON.stringify({
        status: r.status,
        bytes: r.bytes.length,
        sha256: sha256(r.bytes),
      }),
    );
  } else if (command === "promote") {
    const [name, id, cohortCode, tags] = args;
    if (!tags)
      throw new Error(
        "usage: promote <scratchName> <id> <cohortCode|-> <tags>",
      );
    const manifest = readManifest();
    if (manifest.fixtures.some((f) => f.id === id))
      throw new Error(`${id} exists`);
    const bytes = readFileSync(join(scratch, name));
    const meta = JSON.parse(
      readFileSync(join(scratch, `${name}.meta.json`), "utf8"),
    );
    const fixture = {
      id,
      ...(cohortCode === "-" ? {} : { cohortCode }),
      origin: {
        environment: "mkk-development",
        host: DEVELOPMENT_HOST,
        path: meta.path,
      },
      retrievedAt: meta.retrievedAt,
      httpStatus: meta.status,
      contentType: meta.contentType,
      byteLength: bytes.length,
      sha256: sha256(bytes),
      rights: { ...RIGHTS },
      coverage: tags.split(","),
      expectations: [],
    };
    manifest.fixtures.push(fixture);
    const errors = validateManifest(manifest);
    if (errors.length) throw new Error(errors.join("\n"));
    writeFileSync(join(payloadDir, payloadFile(fixture)), bytes);
    writeManifest(manifest);
    console.log(`${id}: ${bytes.length} bytes`);
  } else if (command === "verify") {
    const manifest = readManifest();
    const errors = validateManifest(manifest);
    const results = [
      ...verifyPayloads(manifest),
      ...checkExpectations(manifest),
    ];
    for (const r of results) console.log(`${r.status.padEnd(8)} ${r.id}`);
    const bad = results.filter(
      (r) =>
        (r.status !== "verified" && r.status !== "missing") ||
        (args.includes("--require-payloads") && r.status === "missing"),
    );
    if (errors.length || bad.length) {
      console.error(errors.join("\n"));
      process.exitCode = 1;
    }
  } else {
    throw new Error("commands: get | promote | verify");
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
