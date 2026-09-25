import "server-only";
import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AcquisitionRecord,
  PayloadObjects,
  SourceRecords,
} from "./source-store";

export const SOURCE_PAYLOAD_BUCKET = "source-payloads";

/**
 * Supabase adapters for A05 source storage. The client must carry machine
 * authority (the privileged key); user requests never reach these tables.
 */
export async function createSupabaseSourceStore(client: SupabaseClient) {
  const bucket = await client.storage.getBucket(SOURCE_PAYLOAD_BUCKET);
  // Fail closed unless the bucket exists and is private.
  if (bucket.error || bucket.data.public !== false)
    throw new Error("Source payload bucket is missing or not private");
  const storage = client.storage.from(SOURCE_PAYLOAD_BUCKET);

  const objects: PayloadObjects = {
    async create(key, body) {
      const { error } = await storage.upload(key, body, {
        upsert: false,
        contentType: "application/octet-stream",
      });
      if (!error) return "created";
      // Storage reports an existing key as statusCode "409" (not an overwrite).
      if ((error as { statusCode?: string }).statusCode === "409")
        return "exists";
      throw new Error("Source payload upload failed");
    },
    async read(key) {
      const { data, error } = await storage.download(key);
      if (error) {
        if ((error as { statusCode?: string }).statusCode === "404")
          return null;
        throw new Error("Source payload download failed");
      }
      return new Uint8Array(await data.arrayBuffer());
    },
  };

  const AcquisitionRow = z.object({
    acquisition_id: z.union([z.number(), z.string()]),
    document_id: z.string(),
    outcome: z.enum(["new_revision", "unchanged", "source_error"]),
    revision_id: z.union([z.number(), z.string()]).nullable(),
    revision_number: z.number().int().nullable(),
  });

  const records: SourceRecords = {
    async payloadLength(sha256) {
      const { data, error } = await client
        .from("source_payloads")
        .select("byte_length")
        .eq("sha256", sha256)
        .maybeSingle();
      if (error) throw new Error("Source payload lookup failed");
      return data
        ? z.number().int().nonnegative().parse(data.byte_length)
        : null;
    },
    async recordPayload(sha256, byteLength) {
      const { data, error } = await client.rpc("record_source_payload", {
        p_sha256: sha256,
        p_byte_length: byteLength,
      });
      if (error) throw new Error("Source payload record failed");
      return z.string().parse(data);
    },
    async recordAcquisition(acquisition): Promise<AcquisitionRecord> {
      const { identity } = acquisition;
      const { data, error } = await client.rpc("record_source_acquisition", {
        p_source: identity.source,
        p_resource: identity.resource,
        p_external_key: identity.externalKey,
        p_representation: identity.representation,
        p_subreport_scope: identity.subreportScope,
        p_request_path: identity.requestPath,
        p_requested_at: acquisition.requestedAt.toISOString(),
        p_received_at: acquisition.receivedAt.toISOString(),
        p_http_status: acquisition.httpStatus,
        p_content_type: acquisition.contentType,
        p_payload_sha256: acquisition.payloadSha256,
      });
      if (error) throw new Error("Source acquisition record failed");
      const [row] = z.array(AcquisitionRow).length(1).parse(data);
      return {
        acquisitionId: String(row!.acquisition_id),
        documentId: row!.document_id,
        outcome: row!.outcome,
        revisionId: row!.revision_id === null ? null : String(row!.revision_id),
        revisionNumber: row!.revision_number,
      };
    },
  };

  return { objects, records };
}
