import { Buffer } from "node:buffer";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  RIGHTS,
  checkApiPath,
  checkExpectations,
  fixtureConfig,
  isCoverageTag,
  locateValues,
  payloadExtension,
  manifestPath,
  payloadDir,
  retrieve,
  sha256,
  throttleDelay,
  validateManifest,
  verifyPayloads,
} from "../tools/kap-fixtures.mjs";

const env = {
  KAP_ENV: "development",
  KAP_AUTH_MODE: "basic",
  KAP_BASE_URL: "https://apigwdev.mkk.com.tr/api/vyk",
  KAP_API_KEY: "user",
  KAP_API_SECRET: "pass",
};

const noWait = async () => {};
const payload = Buffer.from('{"presentation":[]}');
const fixture = (overrides = {}) => ({
  id: "tspor-fr-sample",
  cohortCode: "TSPOR",
  origin: {
    environment: "mkk-development",
    host: "apigwdev.mkk.com.tr",
    path: "/disclosureDetail/1234?fileType=data",
  },
  retrievedAt: "2026-09-25T10:00:00.000Z",
  httpStatus: 200,
  contentType: "application/json",
  byteLength: payload.length,
  sha256: sha256(payload),
  rights: { ...RIGHTS },
  coverage: ["financial-report", "non-december-fiscal-year"],
  expectations: [
    {
      locator: { concept: "Assets", contextId: "c1" },
      value: "-661324931.50",
      independentValue: "-661324931.50",
      agrees: true,
      checkedAgainst: { fixture: "tspor-pdf", location: "page 1" },
    },
  ],
  ...overrides,
});
const pdf = {
  ...fixture(),
  id: "tspor-pdf",
  contentType: "application/pdf",
  coverage: ["attachment"],
  expectations: [],
};
const manifest = (fixtures = [fixture()]) => ({
  schemaVersion: 1,
  cohort: [{ stockCode: "TSPOR", reason: "June fiscal year" }],
  fixtures: [...fixtures, pdf],
});

describe("KAP fixture retrieval boundary", () => {
  it("accepts only the MKK development host with basic auth", () => {
    expect(fixtureConfig(env).base).toBe("https://apigwdev.mkk.com.tr/api/vyk");
  });
  it.each([
    { KAP_BASE_URL: "https://apigw.mkk.com.tr/api/vyk" },
    { KAP_BASE_URL: "http://apigwdev.mkk.com.tr/api/vyk" },
    { KAP_BASE_URL: "https://u:p@apigwdev.mkk.com.tr/api/vyk" },
    { KAP_BASE_URL: "https://apigwdev.mkk.com.tr/other" },
    { KAP_BASE_URL: "https://apigwdev.mkk.com.tr.evil.test/api/vyk" },
    { KAP_ENV: "production" },
    { KAP_AUTH_MODE: "token" },
    { KAP_API_SECRET: "" },
  ])("rejects %o", (override) => {
    expect(() => fixtureConfig({ ...env, ...override })).toThrow();
  });
  it.each([
    "/members",
    "/memberSecurities",
    "/lastDisclosureIndex",
    "/disclosures?disclosureIndex=100&companyId=1619",
    "/disclosureDetail/1234?fileType=data",
    "/disclosureDetail/1234?fileType=html&subReportList=general_role_210015",
    "/downloadAttachment/4028328d8b2fcee7018cb581d8ba0af1",
    "/memberDetail/1400",
    "/funds",
    "/funds?fundState=Y",
    "/fundDetail/4471",
    "/caEventStatus?processRefId=12345",
    "/blockedDisclosures",
  ])("allows read-only endpoint %s", (path) => {
    expect(checkApiPath(path)).toBe(path);
  });
  it.each([
    "members",
    "/downloadAttachment/1",
    "/downloadAttachment/4028328D8B2FCEE7018CB581D8BA0AF1",
    "//evil.test/x",
    "/disclosureDetail/1?fileType=data#x",
    "/members/../auth",
    "/auth/generateToken?apiKey=x",
    "/generateToken",
    "/memberDetail/../members",
    "/caEventStatus",
  ])("rejects endpoint %s", (path) => {
    expect(() => checkApiPath(path)).toThrow();
  });
  it("reports status without body or credentials on failure", async () => {
    const fetcher = async () =>
      new globalThis.Response("secret-bearing body pass", { status: 401 });
    const error = await retrieve(
      fixtureConfig(env),
      "/members",
      fetcher,
      noWait,
    ).catch((e) => e);
    expect(error.message).toBe("KAP request failed with HTTP 401");
  });
  it("returns exact response bytes", async () => {
    const fetcher = async (url, init) => {
      expect(url).toBe("https://apigwdev.mkk.com.tr/api/vyk/members");
      expect(init.redirect).toBe("error");
      return new globalThis.Response(payload, { status: 200 });
    };
    const result = await retrieve(
      fixtureConfig(env),
      "/members",
      fetcher,
      noWait,
    );
    expect(Buffer.compare(result.bytes, payload)).toBe(0);
  });
});

describe("KAP rate budget", () => {
  it("allows five calls per rolling minute, then waits for the oldest to expire", () => {
    expect(throttleDelay([], 1000)).toBe(0);
    expect(throttleDelay([1, 2, 3, 4], 1000)).toBe(0);
    expect(throttleDelay([1000, 2000, 3000, 4000, 5000], 10_000)).toBe(51_250);
    expect(throttleDelay([0, 1000, 2000, 3000, 4000], 61_000)).toBe(0);
  });
});

const expectation = (overrides) => ({
  ...fixture().expectations[0],
  ...overrides,
});

describe("KAP fixture manifest", () => {
  it("accepts a complete entry", () => {
    expect(validateManifest(manifest())).toEqual([]);
  });
  it.each([
    [{ id: "Bad Id" }, "kebab-case"],
    [{ sha256: "abc" }, "sha256"],
    [{ retrievedAt: "2026-09-25" }, "retrievedAt"],
    [
      { rights: { ...RIGHTS, redistribution: "permitted" } },
      "rights.redistribution",
    ],
    [{ coverage: ["made-up"] }, "unknown coverage tag"],
    [{ coverage: ["class:ODA x"] }, "unknown coverage tag"],
    [{ httpStatus: 404 }, "error-response"],
    [{ httpStatus: "200" }, "httpStatus"],
    [{ cohortCode: "XXXX" }, "not in the cohort"],
    [
      { origin: { ...fixture().origin, host: "apigw.mkk.com.tr" } },
      "origin.host",
    ],
    [{ expectations: [expectation({ value: 1.5 })] }, "exact decimal string"],
    [{ expectations: [expectation({ value: "1e5" })] }, "exact decimal string"],
    [
      { expectations: [expectation({ independentValue: "1,0" })] },
      "independentValue",
    ],
    [
      { expectations: [expectation({ checkedAgainst: "pdf" })] },
      "checkedAgainst",
    ],
    [
      {
        expectations: [
          expectation({ checkedAgainst: { fixture: "nope", location: "p1" } }),
        ],
      },
      "must be another fixture",
    ],
    [
      { expectations: [expectation({ independentValue: "2", agrees: true })] },
      "agrees",
    ],
  ])("rejects %o", (override, message) => {
    expect(
      validateManifest(manifest([fixture(override)])).join("\n"),
    ).toContain(message);
  });
  it("accepts structured coverage tags and error fixtures tagged as such", () => {
    expect(
      isCoverageTag("template:oda-10000_Material-Event-Disclosure-General"),
    ).toBe(true);
    expect(isCoverageTag("family:par-banks")).toBe(true);
    expect(isCoverageTag("representation:html")).toBe(true);
    expect(
      validateManifest(
        manifest([fixture({ httpStatus: 404, coverage: ["error-response"] })]),
      ),
    ).toEqual([]);
  });
  it.each([
    ["application/json;charset=UTF-8", ".json"],
    ["application/pdf", ".pdf"],
    ["text/html; charset=utf-8", ".html"],
    ["application/octet-stream", ".bin"],
    [undefined, ".bin"],
  ])("maps content type %s to %s", (type, ext) => {
    expect(payloadExtension(type)).toBe(ext);
  });
  it("records a source disagreement instead of repairing it", () => {
    const conflict = expectation({
      value: "-769152983",
      independentValue: "-769152893",
      agrees: false,
    });
    expect(
      validateManifest(manifest([fixture({ expectations: [conflict] })])),
    ).toEqual([]);
  });
  it("rejects duplicate ids", () => {
    expect(validateManifest(manifest([fixture(), fixture()]))).toContain(
      "fixtures[1] (tspor-fr-sample): duplicate id",
    );
  });
  it("verifies payload hashes and reports missing payloads explicitly", () => {
    const m = manifest([
      fixture(),
      fixture({ id: "other" }),
      fixture({ id: "gone" }),
    ]);
    const files = {
      "tspor-fr-sample.json": payload,
      "other.json": Buffer.from("changed"),
    };
    const read = (file) => {
      const bytes = files[file.split("/").pop()];
      if (!bytes) throw new Error("ENOENT");
      return bytes;
    };
    expect(verifyPayloads(m, "/x", read)).toEqual([
      { id: "tspor-fr-sample", status: "verified" },
      { id: "other", status: "mismatch" },
      { id: "gone", status: "missing" },
      { id: "tspor-pdf", status: "missing" },
    ]);
  });
  it("keeps the committed manifest valid", () => {
    const committed = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(validateManifest(committed)).toEqual([]);
  });
});

describe("KAP expectation locator", () => {
  const detail = {
    presentation: [
      {
        id: "bs",
        content: {
          // A single ReportItem object, as KAP sends when there is one child.
          ReportItem: {
            name: "Root",
            ReportItem: [
              {
                name: "Assets",
                Values: {
                  Value: [
                    {
                      contextId: "c1",
                      value: "10",
                      Measures: {
                        Measure: {
                          measureName: "CurrencyTypeAxis",
                          measureValueName: "TotalMember",
                        },
                      },
                    },
                    {
                      contextId: "c1",
                      value: "4",
                      Measures: {
                        Measure: {
                          measureName: "CurrencyTypeAxis",
                          measureValueName: "ForeignCurrencyMember",
                        },
                      },
                    },
                  ],
                },
              },
              // Same concept twice, told apart only by preferredLabel.
              {
                name: "Cash",
                preferredLabel: "periodStartLabel",
                Values: { Value: { contextId: "c1", value: "1" } },
              },
              {
                name: "Cash",
                preferredLabel: "periodEndLabel",
                Values: { Value: { contextId: "c1", value: "2" } },
              },
            ],
          },
        },
      },
    ],
  };
  it("normalizes object/array cardinality and matches the measure set exactly", () => {
    const base = { subReport: "bs", concept: "Assets", contextId: "c1" };
    expect(
      locateValues(detail, {
        ...base,
        measure: { CurrencyTypeAxis: "TotalMember" },
      }),
    ).toEqual(["10"]);
    expect(locateValues(detail, base)).toEqual([]);
  });
  it("uses preferredLabel to separate repeated concepts", () => {
    const base = { subReport: "bs", concept: "Cash", contextId: "c1" };
    expect(locateValues(detail, base)).toEqual(["1", "2"]);
    expect(
      locateValues(detail, { ...base, preferredLabel: "periodEndLabel" }),
    ).toEqual(["2"]);
  });
  it("flags ambiguous and mismatching expectations", () => {
    const m = {
      fixtures: [
        {
          ...fixture(),
          expectations: [
            expectation({
              locator: { subReport: "bs", concept: "Cash", contextId: "c1" },
              value: "1",
            }),
            expectation({
              locator: {
                subReport: "bs",
                concept: "Cash",
                contextId: "c1",
                preferredLabel: "periodEndLabel",
              },
              value: "3",
            }),
          ],
        },
      ],
    };
    const read = () => JSON.stringify(detail);
    expect(checkExpectations(m, "/x", read).map((r) => r.status)).toEqual([
      "ambiguous(2)",
      "mismatch",
    ]);
  });
});

// Real payloads are private and absent in CI: this reports as skipped there,
// never as passed.
const payloadsPresent = existsSync(payloadDir);
describe.skipIf(!payloadsPresent)("KAP private payloads (local only)", () => {
  it("match their recorded hashes and independently checked values", () => {
    const committed = JSON.parse(readFileSync(manifestPath, "utf8"));
    const failures = [
      ...verifyPayloads(committed),
      ...checkExpectations(committed),
    ].filter((r) => r.status !== "verified");
    expect(failures).toEqual([]);
  });
});
