# A08 — Jobs and recovery

- Status: **Proposed 2026-09-25** (task 02.06). The owner accepts it by merging the 02.06 PR. Decisions 1–10 are complete with this PR. Decision 11 (source-wide rate budgets, the bounded runner and scheduler dispatch) is only a direction here; 02.07 completes it and amends this ADR.
- Owner: project owner. 02.07 owns the runner, dispatch, machine authentication and rate budgets. 03.x, 04.x, 05.x and 08.x own the job handlers.
- Implements: blueprint §12.0 "Recoverable execution", §12.19, §28.3, §28.6 and §31 (BC-09). Migration `20260925230000_processing_jobs.sql`. Tests `supabase/tests/processing_jobs.test.sql`, `supabase/tests/processing_jobs_concurrency.test.sql` and `tests/jobs.test.ts`. Code in `apps/api/src/server/jobs/`.

## Context

Ingestion, parsing, metric builds and AI generation run as bounded serverless invocations dispatched by Supabase Cron (§4, §29). An invocation can time out, crash or lose its connection at any point, including after an external call such as a KAP request or an AI generation has already succeeded. Cron and manual refresh can dispatch the same work twice. The queue has to make that safe without a separate queue service.

## Decision

1. **At-least-once execution.** A job may run more than once. Every handler must be idempotent: a rerun either produces the same result or finds the result already published. Exactly-once holds only for publication, through fencing (decision 5).
2. **Job identity is a version-aware idempotency key.** The key has the form `<job_type>:<entity parts…>:<version>`, for example `financial_report_parse:1230809:parser_v1`. It is unique, starts with its job type and ends with a `<name>_v<n>` version of the code or prompt that produces the result. `jobIdempotencyKey` builds keys. The database constraint rejects any other shape.
   - A duplicate enqueue returns the existing job in any state and never resets or re-runs it.
   - A new version is new work. Reprocessing means enqueueing the new version.
   - Reusing a key for a different job type, entity or payload is an integrity error, not a silent merge.
3. **Transactional dispatch.** `enqueue_job` is a SQL function, so it can be called inside the transaction that records the triggering change. The change and its follow-up work then commit together or not at all.
4. **Atomic claiming with leases.** `claim_jobs(worker, types, limit, lease_seconds)` locks due rows with `FOR UPDATE SKIP LOCKED`, sets them to `running`, increments `attempt_count` and opens an attempt row.
   - Concurrent claimers never receive the same job and never wait on each other.
   - Leases last 10–900 seconds and are extended by `renew_job_lease`.
   - Lease times use `clock_timestamp()`, never the transaction start time.
5. **Fencing.** The attempt number is the fencing token. `assert_job_lease(job, attempt)` locks the job row and raises SQLSTATE `55P03` unless that attempt is the job's current attempt, the job is `running` and the lease has not expired.
   - `renew_job_lease`, `complete_job` and `fail_job` call it first.
   - A domain function that publishes a job's results (facts, metrics, generations) must call it first, in the same transaction. A worker whose lease expired can then never publish, even if no one has reclaimed the job yet.
   - While a publisher holds the row lock, no other worker can reclaim the job, so two attempts can never publish concurrently.
   - The TypeScript adapter surfaces `55P03` as `JobLeaseLostError`, and the attempt must stop.
6. **Crash recovery and external-call uncertainty.** Each claim first recovers running jobs whose lease has expired. It closes the open attempt as `lease_expired` and queues the job again, or fails it if no attempts are left.
   - `lease_expired` means the outcome of any external call made by that attempt is **unknown**.
   - The next attempt reconciles before repeating side effects: it reads the source's stored state, checks for an existing result or uses the provider's idempotency. It never assumes the call failed.
   - Paid calls such as AI generations are recorded, keyed by the job's idempotency key, before their results are used (A11).
7. **Checkpoints.** A lease holder may store a JSON `checkpoint` with `renew_job_lease`. It survives failed and lost attempts and is returned by the next claim, so long work resumes from durable state. A handler that needs a checkpoint to be atomic with domain writes calls `assert_job_lease` and writes both in one transaction.
8. **Retries.** `fail_job(job, attempt, code, message, retryable, retry_after?)` handles failures:
   - A retryable failure with attempts left (default `max_attempts` 5, at most 20) returns to `queued` after the given delay, for example from `Retry-After`.
   - Without a given delay the backoff is 30 s × 2^(attempt−1), capped at one hour.
   - A non-retryable failure, or one with no attempts left, is terminal.
   - Error codes are `snake_case`, and messages are truncated to 1,000 characters. Callers must redact messages before recording them: no credentials, tokens or payload bodies. KAP error bodies are A05 source acquisitions, not job messages.
9. **States and history.** Job states are `queued`, `running`, `succeeded` and `failed`, and the two terminal states are final.
   - `processing_job_attempts` keeps one row per claim with worker, claim time, finish time, outcome (`succeeded`, `failed`, `lease_expired`), error code and message, and whether the failure was retryable.
   - An attempt can be closed once and never changed afterwards. Attempts and jobs cannot be deleted or truncated.
   - The job row carries the latest error, the first start and the completion time.
   - Requeueing a terminal job is an operator action for 10.x tooling. Until then, a new version key is the only way to re-run.
10. **Authority.** Users and anonymous callers have no access. Machine authority (`service_role`) can read the queue and change it only through the functions. The tests grant themselves direct writes only to simulate an expired lease or a due retry.
11. **Direction, completed by 02.07.** The runner claims only what it can finish within the platform time limit and renews leases while it works. There is no detached processing: all work is a claimed job.
   - Source-wide rate budgets (KAP requests per minute, AI spend) are durable database state shared by all workers, not per-process counters.
   - Cron dispatch only enqueues and invokes the runner.
   - Machine routes reject user credentials.

## Consequences

- Handlers are written for reruns: they read the checkpoint, reconcile possible earlier side effects and publish only through fenced functions.
- 03.x, 04.x and 05.x add their job types in a migration (the `job_type` check and `JOB_TYPES` are tested to match) and call `assert_job_lease` from their publish functions.
- The queue lives in PostgreSQL: one row lock per claim and one attempt row per run. That is enough for the pilot's volume. A dedicated queue service would need a new ADR.
- Jobs and attempts are retained indefinitely. Archival, if it is ever needed, is a later decision.
