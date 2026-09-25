import { z } from "zod";

/** Job types accepted by `processing_jobs` (A08). Adding one is a migration. */
export const JOB_TYPES = [
  "kap_disclosure_detail",
  "financial_report_parse",
  "metric_recalculation",
  "disclosure_event_extraction",
  "analysis_snapshot",
  "market_valuation_refresh",
  "document_embedding",
] as const;

export type JobType = (typeof JOB_TYPES)[number];

const KEY_PART = /^[A-Za-z0-9_.,=-]+$/;
const VERSION = /^[a-z][a-z0-9_]*_v[0-9]+$/;

/**
 * Builds the idempotency key `<type>:<parts…>:<version>`. The version names the
 * code or prompt that produces the result (e.g. `parser_v1`), so a new version is
 * new work while retries and duplicate dispatches of one version share one job.
 */
export function jobIdempotencyKey(
  type: JobType,
  parts: readonly string[],
  version: string,
) {
  if (!JOB_TYPES.includes(type)) throw new Error("Unknown job type");
  if (parts.length === 0 || parts.some((part) => !KEY_PART.test(part)))
    throw new Error("Job key parts must be non-empty and use safe characters");
  if (!VERSION.test(version))
    throw new Error("Job key version must look like <name>_v<number>");
  const key = [type, ...parts, version].join(":");
  if (key.length > 256)
    throw new Error("Job key is longer than 256 characters");
  return key;
}

const JobObject = z.record(z.string(), z.unknown());
const DatabaseId = z
  .union([z.number().int().positive(), z.string().regex(/^[1-9][0-9]*$/)])
  .transform(String);

const ClaimedJobRow = z.object({
  job_id: DatabaseId,
  job_type: z.enum(JOB_TYPES),
  idempotency_key: z.string(),
  entity_type: z.string().nullable(),
  entity_id: z.string().nullable(),
  payload: JobObject,
  checkpoint: JobObject.nullable(),
  attempt_number: z.number().int().positive(),
  lease_expires_at: z.string(),
});

/**
 * A job claimed by one worker. `attemptNumber` is the fencing token: every later
 * write for this job must pass it, and is rejected once the lease is lost.
 */
export type ClaimedJob = {
  jobId: string;
  type: JobType;
  idempotencyKey: string;
  entity: { type: string; id: string } | null;
  payload: Record<string, unknown>;
  checkpoint: Record<string, unknown> | null;
  attemptNumber: number;
  leaseExpiresAt: Date;
};

export function parseClaimedJobs(data: unknown): ClaimedJob[] {
  return z
    .array(ClaimedJobRow)
    .parse(data)
    .map((row) => {
      const leaseExpiresAt = new Date(row.lease_expires_at);
      if (Number.isNaN(leaseExpiresAt.getTime()))
        throw new Error("Claimed job has an invalid lease expiry");
      return {
        jobId: row.job_id,
        type: row.job_type,
        idempotencyKey: row.idempotency_key,
        entity:
          row.entity_type === null || row.entity_id === null
            ? null
            : { type: row.entity_type, id: row.entity_id },
        payload: row.payload,
        checkpoint: row.checkpoint,
        attemptNumber: row.attempt_number,
        leaseExpiresAt,
      };
    });
}

const EnqueuedJobRow = z.object({
  job_id: DatabaseId,
  created: z.boolean(),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
});

export type EnqueuedJob = {
  jobId: string;
  created: boolean;
  status: "queued" | "running" | "succeeded" | "failed";
};

export function parseEnqueuedJob(data: unknown): EnqueuedJob {
  const [row] = z.array(EnqueuedJobRow).length(1).parse(data);
  return { jobId: row!.job_id, created: row!.created, status: row!.status };
}

/** The lease was lost (expired, superseded or finished); the attempt must stop. */
export class JobLeaseLostError extends Error {
  constructor(jobId: string, attemptNumber: number) {
    super(`Job ${jobId} attempt ${attemptNumber} no longer holds its lease`);
    this.name = "JobLeaseLostError";
  }
}

/** PostgreSQL `lock_not_available`, raised by `assert_job_lease`. */
export const LEASE_LOST_SQLSTATE = "55P03";
