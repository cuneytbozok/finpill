-- Processing jobs (task 02.06, ADR A08).
--
-- A database-backed, at-least-once work queue. A job is one unit of idempotent work
-- identified by a version-aware idempotency key; an attempt is one claim of it by a
-- worker under a lease. The attempt number is the fencing token: every write a
-- worker makes for a job (checkpoint, result, completion, failure) names it, and is
-- accepted only while that attempt still holds an unexpired lease. Lease checks use
-- clock_timestamp(), never the transaction start time.
--
-- Writes come from machine authority through the functions below; users have no access.

create table public.processing_jobs (
  id bigint generated always as identity primary key,
  job_type text not null check (job_type in (
    'kap_disclosure_detail', 'financial_report_parse', 'metric_recalculation',
    'disclosure_event_extraction', 'analysis_snapshot', 'market_valuation_refresh',
    'document_embedding'
  )),
  -- '<job_type>:<entity parts…>:<version>', e.g. 'financial_report_parse:1230809:parser_v1'.
  -- The last segment is the version of the code or prompt that produces the result, so
  -- a new version is new work and an old version's result is never recomputed.
  idempotency_key text not null unique check (
    char_length(idempotency_key) <= 256
    and idempotency_key ~ '^[a-z][a-z0-9_]*(:[A-Za-z0-9_.,=-]+)+:[a-z][a-z0-9_]*_v[0-9]+$'
  ),
  entity_type text check (entity_type ~ '^[a-z][a-z0-9_]{0,63}$'),
  entity_id text check (char_length(entity_id) between 1 and 128),
  payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 16384
  ),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  -- Number of claims so far; the current (or last) attempt's number and fencing token.
  attempt_count integer not null default 0 check (attempt_count >= 0 and attempt_count <= max_attempts),
  run_after timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  -- Progress that survives attempts; written only by the lease holder.
  checkpoint jsonb check (jsonb_typeof(checkpoint) = 'object' and pg_column_size(checkpoint) <= 16384),
  result jsonb check (jsonb_typeof(result) = 'object' and pg_column_size(result) <= 16384),
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (starts_with(idempotency_key, job_type || ':')),
  check ((entity_type is null) = (entity_id is null)),
  check ((status = 'running') = (lease_owner is not null and lease_expires_at is not null)),
  check ((status in ('succeeded', 'failed')) = (completed_at is not null)),
  check (status = 'succeeded' or result is null),
  check (status = 'queued' or attempt_count >= 1)
);

create index processing_jobs_claimable_idx on public.processing_jobs (run_after, id) where status = 'queued';
create index processing_jobs_lease_idx on public.processing_jobs (lease_expires_at) where status = 'running';
create index processing_jobs_entity_idx on public.processing_jobs (entity_type, entity_id);

-- One row per claim. It is inserted when claimed and closed exactly once, with the
-- outcome the queue observed. 'lease_expired' means the outcome of any external call
-- the worker made is unknown; the next attempt must reconcile, not assume.
create table public.processing_job_attempts (
  id bigint generated always as identity primary key,
  job_id bigint not null references public.processing_jobs (id),
  attempt_number integer not null check (attempt_number >= 1),
  worker_id text not null,
  claimed_at timestamptz not null,
  finished_at timestamptz,
  outcome text check (outcome in ('succeeded', 'failed', 'lease_expired')),
  error_code text,
  error_message text,
  retryable boolean,
  unique (job_id, attempt_number),
  check ((finished_at is null) = (outcome is null)),
  check (outcome = 'failed' or (error_code is null and error_message is null and retryable is null)),
  check (outcome is distinct from 'failed' or (error_code is not null and retryable is not null))
);

-- Attempts are history: never deleted; an open attempt may be closed once, nothing else.
create function public.guard_job_attempt_history() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and old.finished_at is null and new.finished_at is not null
    and (new.id, new.job_id, new.attempt_number, new.worker_id, new.claimed_at)
      is not distinct from (old.id, old.job_id, old.attempt_number, old.worker_id, old.claimed_at)
  then
    return new;
  end if;
  raise exception 'processing_job_attempts is append-only' using errcode = 'restrict_violation';
end
$$;

create trigger processing_job_attempts_history before update or delete on public.processing_job_attempts
  for each row execute function public.guard_job_attempt_history();
create trigger processing_job_attempts_no_truncate before truncate on public.processing_job_attempts
  for each statement execute function public.guard_job_attempt_history();

-- Jobs are never deleted; their history is the attempt log.
create function public.guard_job_retention() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'processing_jobs rows are retained' using errcode = 'restrict_violation';
end
$$;

create trigger processing_jobs_retained before delete on public.processing_jobs
  for each row execute function public.guard_job_retention();
create trigger processing_jobs_no_truncate before truncate on public.processing_jobs
  for each statement execute function public.guard_job_retention();

-- Enqueues a job, or returns the existing job with that idempotency key. A key names
-- exactly one piece of work: reusing it for another job type, entity or payload is an
-- integrity error. A duplicate enqueue never resets or re-runs a job, whatever its state.
-- Callable inside the transaction that records the triggering change (transactional dispatch).
create function public.enqueue_job(
  p_job_type text,
  p_idempotency_key text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_payload jsonb default '{}'::jsonb,
  p_run_after timestamptz default null,
  p_max_attempts integer default 5
)
returns table (job_id bigint, created boolean, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.processing_jobs%rowtype;
  new_id bigint;
begin
  insert into public.processing_jobs (
    job_type, idempotency_key, entity_type, entity_id, payload, run_after, max_attempts
  ) values (
    p_job_type, p_idempotency_key, p_entity_type, p_entity_id, coalesce(p_payload, '{}'::jsonb),
    coalesce(p_run_after, clock_timestamp()), coalesce(p_max_attempts, 5)
  )
  on conflict (idempotency_key) do nothing
  returning id into new_id;

  if new_id is not null then
    return query select new_id, true, 'queued'::text;
    return;
  end if;

  select j.* into strict existing from public.processing_jobs j where j.idempotency_key = p_idempotency_key;
  if (existing.job_type, existing.entity_type, existing.entity_id, existing.payload)
    is distinct from (p_job_type, p_entity_type, p_entity_id, coalesce(p_payload, '{}'::jsonb))
  then
    raise exception 'idempotency key % is already used for different work', p_idempotency_key
      using errcode = 'integrity_constraint_violation';
  end if;
  return query select existing.id, false, existing.status;
end
$$;

-- Claims up to p_limit due jobs for one worker. Running jobs whose lease has expired
-- are recovered first: the open attempt is closed as 'lease_expired' and the job is
-- queued again, or failed when it has no attempts left. Rows locked by another
-- transaction are skipped, so concurrent claimers never receive the same job.
create function public.claim_jobs(
  p_worker_id text,
  p_job_types text[],
  p_limit integer default 1,
  p_lease_seconds integer default 120
)
returns table (
  job_id bigint,
  job_type text,
  idempotency_key text,
  entity_type text,
  entity_id text,
  payload jsonb,
  checkpoint jsonb,
  attempt_number integer,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_at timestamptz := clock_timestamp();
begin
  if p_worker_id is null or p_worker_id !~ '^[A-Za-z0-9_.:-]{1,128}$' then
    raise exception 'invalid worker id' using errcode = 'invalid_parameter_value';
  end if;
  if p_limit is null or p_limit not between 1 and 50 then
    raise exception 'claim limit must be between 1 and 50' using errcode = 'invalid_parameter_value';
  end if;
  if p_lease_seconds is null or p_lease_seconds not between 10 and 900 then
    raise exception 'lease must be between 10 and 900 seconds' using errcode = 'invalid_parameter_value';
  end if;
  if p_job_types is null or cardinality(p_job_types) = 0 then
    raise exception 'at least one job type is required' using errcode = 'invalid_parameter_value';
  end if;

  -- Recover expired leases: close the lost attempt, then requeue or fail the job.
  with expired as (
    select j.id, j.attempt_count, j.max_attempts
    from public.processing_jobs j
    where j.status = 'running' and j.lease_expires_at <= now_at and j.job_type = any (p_job_types)
    order by j.lease_expires_at, j.id
    limit 100
    for update skip locked
  ), closed as (
    update public.processing_job_attempts a
    set finished_at = now_at, outcome = 'lease_expired'
    from expired e
    where a.job_id = e.id and a.attempt_number = e.attempt_count and a.finished_at is null
  )
  update public.processing_jobs j
  set status = case when e.attempt_count >= e.max_attempts then 'failed' else 'queued' end,
    run_after = now_at, lease_owner = null, lease_expires_at = null,
    completed_at = case when e.attempt_count >= e.max_attempts then now_at end,
    last_error_code = 'lease_expired', last_error_message = 'lease expired before the attempt finished',
    updated_at = now_at
  from expired e
  where j.id = e.id;

  return query
  with picked as (
    select j.id
    from public.processing_jobs j
    where j.status = 'queued' and j.run_after <= now_at and j.job_type = any (p_job_types)
    order by j.run_after, j.id
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.processing_jobs j
    set status = 'running', attempt_count = j.attempt_count + 1, lease_owner = p_worker_id,
      lease_expires_at = now_at + make_interval(secs => p_lease_seconds),
      started_at = coalesce(j.started_at, now_at), updated_at = now_at
    from picked p
    where j.id = p.id
    returning j.id, j.job_type, j.idempotency_key, j.entity_type, j.entity_id, j.payload,
      j.checkpoint, j.attempt_count, j.lease_expires_at, j.run_after
  ), attempts as (
    insert into public.processing_job_attempts (job_id, attempt_number, worker_id, claimed_at)
    select c.id, c.attempt_count, p_worker_id, now_at from claimed c
  )
  select c.id, c.job_type, c.idempotency_key, c.entity_type, c.entity_id, c.payload,
    c.checkpoint, c.attempt_count, c.lease_expires_at
  from claimed c
  order by c.run_after, c.id;
end
$$;

-- Fencing check. Locks the job row and raises unless p_attempt_number still holds an
-- unexpired lease. Domain functions that publish a job's results call this first, in
-- the same transaction, so a worker that lost its lease can never publish; while the
-- row is locked no other worker can reclaim the job.
create function public.assert_job_lease(p_job_id bigint, p_attempt_number integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.processing_jobs%rowtype;
begin
  select j.* into job from public.processing_jobs j where j.id = p_job_id for update;
  if job.id is null
    or job.status <> 'running'
    or job.attempt_count <> p_attempt_number
    or job.lease_expires_at <= clock_timestamp()
  then
    raise exception 'job % attempt % does not hold a valid lease', p_job_id, p_attempt_number
      using errcode = 'lock_not_available';
  end if;
end
$$;

-- Extends the lease and optionally records a checkpoint. A checkpoint written here is
-- visible to the next attempt if this one is lost.
create function public.renew_job_lease(
  p_job_id bigint,
  p_attempt_number integer,
  p_lease_seconds integer default 120,
  p_checkpoint jsonb default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  expires timestamptz;
begin
  if p_lease_seconds is null or p_lease_seconds not between 10 and 900 then
    raise exception 'lease must be between 10 and 900 seconds' using errcode = 'invalid_parameter_value';
  end if;
  perform public.assert_job_lease(p_job_id, p_attempt_number);
  expires := clock_timestamp() + make_interval(secs => p_lease_seconds);
  update public.processing_jobs j
  set lease_expires_at = expires, checkpoint = coalesce(p_checkpoint, j.checkpoint), updated_at = clock_timestamp()
  where j.id = p_job_id;
  return expires;
end
$$;

-- Completes the job. Accepted only from the attempt holding the lease; a completed job
-- is never claimed again.
create function public.complete_job(p_job_id bigint, p_attempt_number integer, p_result jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_at timestamptz := clock_timestamp();
begin
  perform public.assert_job_lease(p_job_id, p_attempt_number);
  update public.processing_jobs j
  set status = 'succeeded', result = p_result, lease_owner = null, lease_expires_at = null,
    completed_at = now_at, updated_at = now_at
  where j.id = p_job_id;
  update public.processing_job_attempts a
  set finished_at = now_at, outcome = 'succeeded'
  where a.job_id = p_job_id and a.attempt_number = p_attempt_number;
end
$$;

-- Records a failed attempt. A retryable failure with attempts left is queued again
-- after a delay (exponential backoff from 30 seconds, capped at one hour, unless the
-- caller gives one, e.g. from Retry-After); otherwise the job fails terminally.
-- Messages must already be redacted: they are stored and shown to operators.
create function public.fail_job(
  p_job_id bigint,
  p_attempt_number integer,
  p_error_code text,
  p_error_message text,
  p_retryable boolean,
  p_retry_after_seconds integer default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_at timestamptz := clock_timestamp();
  job public.processing_jobs%rowtype;
  next_status text;
  delay_seconds integer;
begin
  if p_error_code is null or p_error_code !~ '^[a-z][a-z0-9_]{0,63}$' then
    raise exception 'invalid error code' using errcode = 'invalid_parameter_value';
  end if;
  if p_retryable is null then
    raise exception 'retryable is required' using errcode = 'null_value_not_allowed';
  end if;
  if p_retry_after_seconds is not null and p_retry_after_seconds not between 0 and 86400 then
    raise exception 'retry delay must be between 0 and 86400 seconds' using errcode = 'invalid_parameter_value';
  end if;
  perform public.assert_job_lease(p_job_id, p_attempt_number);
  select j.* into strict job from public.processing_jobs j where j.id = p_job_id;

  next_status := case when p_retryable and job.attempt_count < job.max_attempts then 'queued' else 'failed' end;
  delay_seconds := coalesce(p_retry_after_seconds, least(30 * power(2, job.attempt_count - 1), 3600)::integer);

  update public.processing_jobs j
  set status = next_status, lease_owner = null, lease_expires_at = null,
    run_after = case when next_status = 'queued' then now_at + make_interval(secs => delay_seconds) else j.run_after end,
    completed_at = case when next_status = 'failed' then now_at end,
    last_error_code = p_error_code, last_error_message = left(p_error_message, 1000), updated_at = now_at
  where j.id = p_job_id;
  update public.processing_job_attempts a
  set finished_at = now_at, outcome = 'failed', error_code = p_error_code,
    error_message = left(p_error_message, 1000), retryable = p_retryable
  where a.job_id = p_job_id and a.attempt_number = p_attempt_number;
  return next_status;
end
$$;

alter table public.processing_jobs enable row level security;
alter table public.processing_job_attempts enable row level security;

revoke all on public.processing_jobs, public.processing_job_attempts from public, anon, authenticated, service_role;

revoke execute on function
  public.guard_job_attempt_history(),
  public.guard_job_retention(),
  public.enqueue_job(text, text, text, text, jsonb, timestamptz, integer),
  public.claim_jobs(text, text[], integer, integer),
  public.assert_job_lease(bigint, integer),
  public.renew_job_lease(bigint, integer, integer, jsonb),
  public.complete_job(bigint, integer, jsonb),
  public.fail_job(bigint, integer, text, text, boolean, integer)
from public, anon, authenticated, service_role;

-- Machine authority reads the queue and changes it only through the functions.
grant select on public.processing_jobs, public.processing_job_attempts to service_role;
grant execute on function
  public.enqueue_job(text, text, text, text, jsonb, timestamptz, integer),
  public.claim_jobs(text, text[], integer, integer),
  public.assert_job_lease(bigint, integer),
  public.renew_job_lease(bigint, integer, integer, jsonb),
  public.complete_job(bigint, integer, jsonb),
  public.fail_job(bigint, integer, text, text, boolean, integer)
to service_role;
