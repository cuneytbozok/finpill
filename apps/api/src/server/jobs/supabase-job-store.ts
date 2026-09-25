import "server-only";
import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  JobLeaseLostError,
  LEASE_LOST_SQLSTATE,
  parseClaimedJobs,
  parseEnqueuedJob,
} from "./jobs";
import type { JobType } from "./jobs";

type JobError = { code?: string } | null;

/**
 * Supabase adapter for the A08 job functions. The client must carry machine
 * authority (the privileged key); user requests never reach the queue. Error
 * details are not forwarded, so database messages never reach logs verbatim.
 */
export function createSupabaseJobStore(client: SupabaseClient) {
  function fenced(error: JobError, jobId: string, attemptNumber: number) {
    if (!error) return;
    if (error.code === LEASE_LOST_SQLSTATE)
      throw new JobLeaseLostError(jobId, attemptNumber);
    throw new Error("Job update failed");
  }

  return {
    async enqueue(job: {
      type: JobType;
      idempotencyKey: string;
      entity?: { type: string; id: string };
      payload?: Record<string, unknown>;
      runAfter?: Date;
      maxAttempts?: number;
    }) {
      const { data, error } = await client.rpc("enqueue_job", {
        p_job_type: job.type,
        p_idempotency_key: job.idempotencyKey,
        p_entity_type: job.entity?.type ?? null,
        p_entity_id: job.entity?.id ?? null,
        p_payload: job.payload ?? {},
        p_run_after: job.runAfter?.toISOString() ?? null,
        p_max_attempts: job.maxAttempts ?? 5,
      });
      if (error) throw new Error("Job enqueue failed");
      return parseEnqueuedJob(data);
    },

    async claim(
      workerId: string,
      types: readonly JobType[],
      limit: number,
      leaseSeconds: number,
    ) {
      const { data, error } = await client.rpc("claim_jobs", {
        p_worker_id: workerId,
        p_job_types: types,
        p_limit: limit,
        p_lease_seconds: leaseSeconds,
      });
      if (error) throw new Error("Job claim failed");
      return parseClaimedJobs(data);
    },

    async renew(
      jobId: string,
      attemptNumber: number,
      leaseSeconds: number,
      checkpoint?: Record<string, unknown>,
    ) {
      const { data, error } = await client.rpc("renew_job_lease", {
        p_job_id: jobId,
        p_attempt_number: attemptNumber,
        p_lease_seconds: leaseSeconds,
        p_checkpoint: checkpoint ?? null,
      });
      fenced(error, jobId, attemptNumber);
      return new Date(z.string().parse(data));
    },

    async complete(
      jobId: string,
      attemptNumber: number,
      result?: Record<string, unknown>,
    ) {
      const { error } = await client.rpc("complete_job", {
        p_job_id: jobId,
        p_attempt_number: attemptNumber,
        p_result: result ?? null,
      });
      fenced(error, jobId, attemptNumber);
    },

    async fail(
      jobId: string,
      attemptNumber: number,
      failure: {
        code: string;
        message: string;
        retryable: boolean;
        retryAfterSeconds?: number;
      },
    ) {
      const { data, error } = await client.rpc("fail_job", {
        p_job_id: jobId,
        p_attempt_number: attemptNumber,
        p_error_code: failure.code,
        p_error_message: failure.message,
        p_retryable: failure.retryable,
        p_retry_after_seconds: failure.retryAfterSeconds ?? null,
      });
      fenced(error, jobId, attemptNumber);
      return z.enum(["queued", "failed"]).parse(data);
    },
  };
}
