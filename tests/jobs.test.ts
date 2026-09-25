import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  JOB_TYPES,
  jobIdempotencyKey,
  parseClaimedJobs,
  parseEnqueuedJob,
} from "../apps/api/src/server/jobs/jobs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260925230000_processing_jobs.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("job idempotency keys", () => {
  it("builds the blueprint's version-aware keys", () => {
    expect(
      jobIdempotencyKey("financial_report_parse", ["1230809"], "parser_v1"),
    ).toBe("financial_report_parse:1230809:parser_v1");
    expect(
      jobIdempotencyKey(
        "analysis_snapshot",
        ["1619", "2026-06-30"],
        "analysis_v1",
      ),
    ).toBe("analysis_snapshot:1619:2026-06-30:analysis_v1");
  });

  it("matches the database key constraint", () => {
    const pattern = migration.match(/idempotency_key ~ '([^']+)'/)?.[1];
    expect(pattern).toBeDefined();
    const key = jobIdempotencyKey("document_embedding", ["a.b", "c=d"], "e_v2");
    expect(new RegExp(pattern!).test(key)).toBe(true);
  });

  it("rejects keys that would not name one version of one piece of work", () => {
    expect(() =>
      jobIdempotencyKey("metric_recalculation", [], "m_v1"),
    ).toThrow();
    expect(() =>
      jobIdempotencyKey("metric_recalculation", ["a:b"], "m_v1"),
    ).toThrow();
    expect(() =>
      jobIdempotencyKey("metric_recalculation", ["1"], "latest"),
    ).toThrow();
    expect(() =>
      jobIdempotencyKey("metric_recalculation", ["x".repeat(300)], "m_v1"),
    ).toThrow();
    expect(() =>
      jobIdempotencyKey("unknown" as never, ["1"], "m_v1"),
    ).toThrow();
  });

  it("lists exactly the job types the database accepts", () => {
    const list = migration.match(/job_type in \(([^)]+)\)/)?.[1] ?? "";
    expect([...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])).toEqual([
      ...JOB_TYPES,
    ]);
  });
});

describe("job row parsing", () => {
  it("parses claimed jobs with their fencing attempt number", () => {
    const [job] = parseClaimedJobs([
      {
        job_id: 42,
        job_type: "financial_report_parse",
        idempotency_key: "financial_report_parse:1230809:parser_v1",
        entity_type: "disclosure",
        entity_id: "1230809",
        payload: { disclosureIndex: "1230809" },
        checkpoint: { page: 3 },
        attempt_number: 2,
        lease_expires_at: "2026-09-25T10:02:00+00:00",
      },
    ]);
    expect(job).toEqual({
      jobId: "42",
      type: "financial_report_parse",
      idempotencyKey: "financial_report_parse:1230809:parser_v1",
      entity: { type: "disclosure", id: "1230809" },
      payload: { disclosureIndex: "1230809" },
      checkpoint: { page: 3 },
      attemptNumber: 2,
      leaseExpiresAt: new Date("2026-09-25T10:02:00Z"),
    });
  });

  it("keeps bigint ids exact as strings", () => {
    expect(
      parseEnqueuedJob([
        { job_id: "9007199254740993", created: false, status: "succeeded" },
      ]),
    ).toEqual({
      jobId: "9007199254740993",
      created: false,
      status: "succeeded",
    });
  });

  it("rejects malformed rows instead of guessing", () => {
    expect(() => parseEnqueuedJob([])).toThrow();
    expect(() =>
      parseClaimedJobs([
        {
          job_id: 1,
          job_type: "other",
          idempotency_key: "k",
          entity_type: null,
          entity_id: null,
          payload: {},
          checkpoint: null,
          attempt_number: 1,
          lease_expires_at: "2026-09-25T10:00:00Z",
        },
      ]),
    ).toThrow();
    expect(() =>
      parseClaimedJobs([
        {
          job_id: 1,
          job_type: "metric_recalculation",
          idempotency_key: "k",
          entity_type: null,
          entity_id: null,
          payload: {},
          checkpoint: null,
          attempt_number: 1,
          lease_expires_at: "soon",
        },
      ]),
    ).toThrow();
  });
});
