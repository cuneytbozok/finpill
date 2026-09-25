import { createHash } from "node:crypto";

import type { SourceIdentity } from "./kap-source-identity";

/** Private object storage. `create` never replaces an existing object. */
export type PayloadObjects = {
  create(key: string, body: Uint8Array): Promise<"created" | "exists">;
  read(key: string): Promise<Uint8Array | null>;
};

export type AcquisitionRecord = {
  acquisitionId: string;
  documentId: string;
  outcome: "new_revision" | "unchanged" | "source_error";
  revisionId: string | null;
  revisionNumber: number | null;
};

/** Database records, written only through the A05 functions. */
export type SourceRecords = {
  payloadLength(sha256: string): Promise<number | null>;
  recordPayload(sha256: string, byteLength: number): Promise<string>;
  recordAcquisition(
    acquisition: SourceAcquisition & { payloadSha256: string },
  ): Promise<AcquisitionRecord>;
};

export type SourceAcquisition = {
  identity: SourceIdentity;
  requestedAt: Date;
  receivedAt: Date;
  httpStatus: number;
  contentType: string | null;
};

export class SourceIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceIntegrityError";
  }
}

export function sha256Hex(body: Uint8Array) {
  return createHash("sha256").update(body).digest("hex");
}

/** Content-addressed key: one body, one object. */
export function payloadKey(sha256: string) {
  if (!/^[0-9a-f]{64}$/.test(sha256))
    throw new SourceIntegrityError("Malformed payload hash");
  return `sha256/${sha256.slice(0, 2)}/${sha256}`;
}

function verify(body: Uint8Array | null, sha256: string, byteLength: number) {
  if (!body || body.byteLength !== byteLength || sha256Hex(body) !== sha256)
    throw new SourceIntegrityError(`Stored payload ${sha256} does not match`);
  return body;
}

/**
 * Stores exact bytes before anything parses them. Safe to retry after an
 * interruption at any point: an object left by an unrecorded attempt is verified
 * and reused, and a hash already recorded skips the upload.
 */
export async function storeSourcePayload(
  body: Uint8Array,
  objects: PayloadObjects,
  records: SourceRecords,
) {
  const sha256 = sha256Hex(body);
  const key = payloadKey(sha256);
  const known = await records.payloadLength(sha256);
  if (known !== null) {
    if (known !== body.byteLength)
      throw new SourceIntegrityError(`Payload ${sha256} length differs`);
    return { sha256, storageKey: key, byteLength: body.byteLength };
  }
  if ((await objects.create(key, body)) === "exists")
    verify(await objects.read(key), sha256, body.byteLength);
  if ((await records.recordPayload(sha256, body.byteLength)) !== key)
    throw new SourceIntegrityError(`Payload ${sha256} key differs`);
  return { sha256, storageKey: key, byteLength: body.byteLength };
}

/** Stores a received response and records it as a revision, observation or source error. */
export async function acquireSource(
  acquisition: SourceAcquisition,
  body: Uint8Array,
  objects: PayloadObjects,
  records: SourceRecords,
) {
  const payload = await storeSourcePayload(body, objects, records);
  return records.recordAcquisition({
    ...acquisition,
    payloadSha256: payload.sha256,
  });
}

/** Reads a payload back and fails unless it is byte-for-byte what was recorded. */
export async function readSourcePayload(
  sha256: string,
  byteLength: number,
  objects: PayloadObjects,
) {
  return verify(await objects.read(payloadKey(sha256)), sha256, byteLength);
}
