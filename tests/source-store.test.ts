import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { kapSourceIdentity } from "../apps/api/src/server/sources/kap-source-identity";
import {
  SourceIntegrityError,
  acquireSource,
  payloadKey,
  readSourcePayload,
  sha256Hex,
  storeSourcePayload,
} from "../apps/api/src/server/sources/source-store";

import type {
  PayloadObjects,
  SourceRecords,
} from "../apps/api/src/server/sources/source-store";

const manifest = JSON.parse(
  readFileSync(new URL("fixtures/kap/manifest.json", import.meta.url), "utf8"),
) as { fixtures: { origin: { path: string } }[] };

describe("KAP source identity", () => {
  it("maps every evidence-pack request to a logical document", () => {
    for (const { origin } of manifest.fixtures)
      expect(kapSourceIdentity(origin.path).requestPath).toBe(origin.path);
  });

  it("keeps representations and subreport scopes apart", () => {
    const keys = [
      "/disclosureDetail/1230809?fileType=data",
      "/disclosureDetail/1230809?fileType=html",
      "/disclosureDetail/1230809?fileType=pdf",
      "/disclosureDetail/1230809?fileType=data&subReportList=general_role_210015",
    ].map((path) => {
      const id = kapSourceIdentity(path);
      return [
        id.resource,
        id.externalKey,
        id.representation,
        id.subreportScope,
      ].join("|");
    });
    expect(new Set(keys).size).toBe(4);
    expect(keys[3]).toBe("disclosure_detail|1230809|data|general_role_210015");
  });

  it("canonicalizes list parameter order but not values", () => {
    const a = kapSourceIdentity("/disclosures?disclosureIndex=1&companyId=5,4");
    const b = kapSourceIdentity("/disclosures?companyId=5,4&disclosureIndex=1");
    expect(a.externalKey).toBe("companyId=5,4&disclosureIndex=1");
    expect(b.externalKey).toBe(a.externalKey);
    expect(kapSourceIdentity("/members")).toMatchObject({
      resource: "members",
      externalKey: "all",
      representation: "json",
      subreportScope: "all",
    });
    expect(kapSourceIdentity("/downloadAttachment/4028abc")).toMatchObject({
      resource: "attachment",
      representation: "file",
    });
  });

  it.each([
    "https://apigwdev.mkk.com.tr/api/vyk/members",
    "//user:pass@example.com/members",
    "/members?x=1",
    "/disclosureDetail/1230809",
    "/disclosureDetail/1230809?fileType=data&extra=1",
    "/disclosureDetail/1230809?fileType=data&fileType=html",
    "/disclosures",
    "/generateToken",
    "/toString/1",
    "/members#fragment",
  ])("rejects %s", (path) => {
    expect(() => kapSourceIdentity(path)).toThrow(
      "Unsupported KAP source request",
    );
  });
});

function memoryStore() {
  const objectMap = new Map<string, Uint8Array>();
  const payloads = new Map<string, number>();
  const calls = { uploads: 0, reads: 0, acquisitions: 0 };
  let failNextRecord = false;
  const objects: PayloadObjects = {
    async create(key, body) {
      calls.uploads += 1;
      if (objectMap.has(key)) return "exists";
      objectMap.set(key, body.slice());
      return "created";
    },
    async read(key) {
      calls.reads += 1;
      return objectMap.get(key)?.slice() ?? null;
    },
  };
  const records: SourceRecords = {
    async payloadLength(sha256) {
      return payloads.get(sha256) ?? null;
    },
    async recordPayload(sha256, byteLength) {
      if (failNextRecord) {
        failNextRecord = false;
        throw new Error("connection lost");
      }
      payloads.set(sha256, byteLength);
      return payloadKey(sha256);
    },
    async recordAcquisition(acquisition) {
      calls.acquisitions += 1;
      if (!payloads.has(acquisition.payloadSha256)) throw new Error("FK");
      return {
        acquisitionId: String(calls.acquisitions),
        documentId: "doc",
        outcome: "new_revision",
        revisionId: "1",
        revisionNumber: 1,
      };
    },
  };
  return {
    objectMap,
    payloads,
    calls,
    objects,
    records,
    interruptNextRecord: () => (failNextRecord = true),
  };
}

const body = new TextEncoder().encode(
  '{"value":"60024084000","rounding":"-3"}',
);
const hash = sha256Hex(body);

describe("source payload storage", () => {
  it("stores exact bytes under a content-addressed key", async () => {
    const store = memoryStore();
    const stored = await storeSourcePayload(body, store.objects, store.records);
    expect(stored.storageKey).toBe(`sha256/${hash.slice(0, 2)}/${hash}`);
    expect(store.objectMap.get(stored.storageKey)).toEqual(body);
    expect(store.payloads.get(hash)).toBe(body.byteLength);
  });

  it("skips the upload for a body already recorded", async () => {
    const store = memoryStore();
    await storeSourcePayload(body, store.objects, store.records);
    await storeSourcePayload(body, store.objects, store.records);
    expect(store.calls.uploads).toBe(1);
  });

  it("recovers from an upload interrupted before it was recorded", async () => {
    const store = memoryStore();
    store.interruptNextRecord();
    await expect(
      storeSourcePayload(body, store.objects, store.records),
    ).rejects.toThrow("connection lost");
    expect(store.payloads.size).toBe(0);
    await storeSourcePayload(body, store.objects, store.records);
    expect(store.calls.reads).toBe(1);
    expect(store.payloads.get(hash)).toBe(body.byteLength);
  });

  it("never records or overwrites a conflicting object at a content key", async () => {
    const store = memoryStore();
    store.objectMap.set(payloadKey(hash), new TextEncoder().encode("partial"));
    await expect(
      storeSourcePayload(body, store.objects, store.records),
    ).rejects.toBeInstanceOf(SourceIntegrityError);
    expect(store.payloads.size).toBe(0);
    expect(
      new TextDecoder().decode(store.objectMap.get(payloadKey(hash))),
    ).toBe("partial");
  });

  it("keeps the payload when parsing fails after acquisition", async () => {
    const store = memoryStore();
    const identity = kapSourceIdentity(
      "/disclosureDetail/1230809?fileType=data",
    );
    const parse = () => {
      throw new Error("unsupported shape");
    };
    await expect(
      acquireSource(
        {
          identity,
          requestedAt: new Date("2026-09-25T10:00:00Z"),
          receivedAt: new Date("2026-09-25T10:00:01Z"),
          httpStatus: 200,
          contentType: "application/json",
        },
        body,
        store.objects,
        store.records,
      ).then(parse),
    ).rejects.toThrow("unsupported shape");
    expect(
      await readSourcePayload(hash, body.byteLength, store.objects),
    ).toEqual(body);
    expect(store.calls.acquisitions).toBe(1);
  });

  it("detects a missing or altered stored payload on read", async () => {
    const store = memoryStore();
    await expect(
      readSourcePayload(hash, body.byteLength, store.objects),
    ).rejects.toBeInstanceOf(SourceIntegrityError);
    store.objectMap.set(
      payloadKey(hash),
      body.map((b, i) => (i ? b : b + 1)),
    );
    await expect(
      readSourcePayload(hash, body.byteLength, store.objects),
    ).rejects.toBeInstanceOf(SourceIntegrityError);
  });
});
