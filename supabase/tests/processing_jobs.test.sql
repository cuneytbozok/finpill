begin;
select plan(46);

select has_table('public', 'processing_jobs', 'processing jobs table exists');
select has_table('public', 'processing_job_attempts', 'job attempts table exists');

-- Enqueue: version-aware idempotency keys deduplicate; a key names one piece of work.
select results_eq(
  $$select created, status from public.enqueue_job(
      'financial_report_parse', 'financial_report_parse:1230809:parser_v1',
      'disclosure', '1230809', '{"disclosureIndex": "1230809"}')$$,
  $$values (true, 'queued')$$,
  'a new key enqueues a job'
);
select results_eq(
  $$select created, status from public.enqueue_job(
      'financial_report_parse', 'financial_report_parse:1230809:parser_v1',
      'disclosure', '1230809', '{"disclosureIndex": "1230809"}')$$,
  $$values (false, 'queued')$$,
  'a duplicate enqueue returns the existing job'
);
select is(
  (select count(*)::integer from public.processing_jobs where idempotency_key = 'financial_report_parse:1230809:parser_v1'),
  1, 'a duplicate enqueue creates nothing'
);
select throws_ok(
  $$select * from public.enqueue_job(
      'financial_report_parse', 'financial_report_parse:1230809:parser_v1',
      'disclosure', '1230809', '{"disclosureIndex": "999"}')$$,
  '23000', null, 'reusing a key for a different payload is an integrity failure'
);
select results_eq(
  $$select created from public.enqueue_job(
      'financial_report_parse', 'financial_report_parse:1230809:parser_v2',
      'disclosure', '1230809', '{"disclosureIndex": "1230809"}', now() + interval '1 day')$$,
  $$values (true)$$,
  'a new version is new work'
);
select throws_ok(
  $$select * from public.enqueue_job('financial_report_parse', 'financial_report_parse:1230809')$$,
  '23514', null, 'a key without a version segment is rejected'
);
select throws_ok(
  $$select * from public.enqueue_job('metric_recalculation', 'financial_report_parse:1230809:parser_v1')$$,
  '23514', null, 'a key must start with its job type'
);
select throws_ok(
  $$select * from public.enqueue_job('unknown_job', 'unknown_job:1:thing_v1')$$,
  '23514', null, 'an unknown job type is rejected'
);
select throws_ok(
  $$select * from public.enqueue_job('metric_recalculation', 'metric_recalculation:1:metrics_v1', 'issuer', null)$$,
  '23514', null, 'an entity needs both type and id'
);
select throws_ok(
  $$select * from public.enqueue_job('metric_recalculation', 'metric_recalculation:1:metrics_v1', null, null, '[]')$$,
  '23514', null, 'the payload must be an object'
);

-- Claim: attempt 1, lease, attempt row. Other work is scheduled out of the way.
select public.enqueue_job('metric_recalculation', 'metric_recalculation:later:metrics_v1',
  null, null, '{}', now() + interval '1 day');
select results_eq(
  $$select idempotency_key, attempt_number, checkpoint is null
    from public.claim_jobs('worker-a', array['financial_report_parse'], 1, 60)$$,
  $$values ('financial_report_parse:1230809:parser_v1'::text, 1, true)$$,
  'the oldest due job is claimed as attempt 1'
);
select results_eq(
  $$select status, attempt_count, lease_owner from public.processing_jobs
    where idempotency_key = 'financial_report_parse:1230809:parser_v1'$$,
  $$values ('running'::text, 1, 'worker-a'::text)$$,
  'the claimed job is running under the worker lease'
);
select is(
  (select count(*)::integer from public.processing_job_attempts a join public.processing_jobs j on j.id = a.job_id
   where j.idempotency_key = 'financial_report_parse:1230809:parser_v1' and a.finished_at is null),
  1, 'the claim opened one attempt'
);
select is_empty(
  $$select * from public.claim_jobs('worker-b', array['metric_recalculation'], 5, 60)$$,
  'a job scheduled for later is not claimed'
);
select throws_ok(
  $$select * from public.claim_jobs('worker a', array['metric_recalculation'], 1, 60)$$,
  '22023', null, 'a malformed worker id is rejected'
);
select throws_ok(
  $$select * from public.claim_jobs('worker-a', array['metric_recalculation'], 1, 5)$$,
  '22023', null, 'a lease outside 10–900 seconds is rejected'
);

-- Lease: renew with checkpoint; a wrong attempt number is fenced out.
create temporary table job_ids as
  select id, idempotency_key from public.processing_jobs;
select lives_ok(
  $$select public.renew_job_lease(
      (select id from job_ids where idempotency_key = 'financial_report_parse:1230809:parser_v1'),
      1, 60, '{"page": 3}')$$,
  'the lease holder renews and checkpoints'
);
select throws_ok(
  $$select public.renew_job_lease(
      (select id from job_ids where idempotency_key = 'financial_report_parse:1230809:parser_v1'), 2, 60)$$,
  '55P03', null, 'another attempt number cannot renew'
);
select throws_ok(
  $$select public.complete_job(
      (select id from job_ids where idempotency_key = 'financial_report_parse:1230809:parser_v1'), 0)$$,
  '55P03', null, 'another attempt number cannot complete'
);

-- Crash recovery: the lease expires; the next claim closes the lost attempt and resumes
-- from the checkpoint, and the old attempt can no longer commit.
update public.processing_jobs set lease_expires_at = clock_timestamp() - interval '1 second'
where idempotency_key = 'financial_report_parse:1230809:parser_v1';
select throws_ok(
  $$select public.complete_job(
      (select id from job_ids where idempotency_key = 'financial_report_parse:1230809:parser_v1'), 1)$$,
  '55P03', null, 'an expired lease cannot complete, even before another claim'
);
select results_eq(
  $$select idempotency_key, attempt_number, checkpoint
    from public.claim_jobs('worker-b', array['financial_report_parse'], 1, 60)$$,
  $$values ('financial_report_parse:1230809:parser_v1'::text, 2, '{"page": 3}'::jsonb)$$,
  'the expired job is reclaimed as attempt 2 with its checkpoint'
);
select throws_ok(
  $$select public.fail_job(
      (select id from job_ids where idempotency_key = 'financial_report_parse:1230809:parser_v1'),
      1, 'network_error', 'late', true)$$,
  '55P03', null, 'the superseded attempt cannot record a failure'
);

-- Retry: a retryable failure requeues with backoff; history is preserved.
select is(
  public.fail_job((select id from job_ids where idempotency_key = 'financial_report_parse:1230809:parser_v1'),
    2, 'kap_rate_limited', 'HTTP 429', true, 120),
  'queued', 'a retryable failure with attempts left is queued again'
);
select ok(
  (select run_after > clock_timestamp() + interval '100 seconds' from public.processing_jobs
   where idempotency_key = 'financial_report_parse:1230809:parser_v1'),
  'the retry waits for the requested delay'
);
select is_empty(
  $$select * from public.claim_jobs('worker-c', array['financial_report_parse'], 1, 60)
    where idempotency_key = 'financial_report_parse:1230809:parser_v1'$$,
  'a job waiting for retry is not claimed early'
);
update public.processing_jobs set run_after = clock_timestamp() - interval '1 second'
where idempotency_key = 'financial_report_parse:1230809:parser_v1';
select results_eq(
  $$select attempt_number from public.claim_jobs('worker-c', array['financial_report_parse'], 1, 60)$$,
  $$values (3)$$,
  'the due retry is claimed as attempt 3'
);
select lives_ok(
  $$select public.complete_job(
      (select id from job_ids where idempotency_key = 'financial_report_parse:1230809:parser_v1'),
      3, '{"facts": 42}')$$,
  'the lease holder completes the job'
);
select results_eq(
  $$select a.attempt_number, a.worker_id, a.outcome, a.error_code, a.retryable
    from public.processing_job_attempts a join job_ids j on j.id = a.job_id
    where j.idempotency_key = 'financial_report_parse:1230809:parser_v1' order by a.attempt_number$$,
  $$values (1, 'worker-a'::text, 'lease_expired'::text, null::text, null::boolean),
           (2, 'worker-b', 'failed', 'kap_rate_limited', true),
           (3, 'worker-c', 'succeeded', null, null)$$,
  'every attempt is preserved with its outcome'
);
select results_eq(
  $$select status, result, lease_owner is null, completed_at is not null from public.processing_jobs
    where idempotency_key = 'financial_report_parse:1230809:parser_v1'$$,
  $$values ('succeeded'::text, '{"facts": 42}'::jsonb, true, true)$$,
  'the job succeeded with its result'
);
select results_eq(
  $$select created, status from public.enqueue_job(
      'financial_report_parse', 'financial_report_parse:1230809:parser_v1',
      'disclosure', '1230809', '{"disclosureIndex": "1230809"}')$$,
  $$values (false, 'succeeded')$$,
  'enqueueing a completed key does not re-run it'
);
select throws_ok(
  $$select public.complete_job(
      (select id from job_ids where idempotency_key = 'financial_report_parse:1230809:parser_v1'), 3)$$,
  '55P03', null, 'a completed job cannot be completed again'
);

-- Terminal failures: non-retryable, retries exhausted, leases exhausted.
update public.processing_jobs set run_after = clock_timestamp() - interval '1 second'
where idempotency_key = 'financial_report_parse:1230809:parser_v2';
select public.enqueue_job('analysis_snapshot', 'analysis_snapshot:1619:2026-06-30:analysis_v1',
  null, null, '{}', null, 2);
select public.enqueue_job('document_embedding', 'document_embedding:1665704:embed_v1',
  null, null, '{}', null, 1);
select is(
  public.fail_job((select job_id from public.claim_jobs('w1', array['financial_report_parse'], 1, 60)),
    1, 'parse_unsupported', 'unsupported taxonomy', false),
  'failed', 'a non-retryable failure is terminal'
);
select is(
  public.fail_job((select job_id from public.claim_jobs('w1', array['analysis_snapshot'], 1, 60)),
    1, 'provider_error', 'upstream 500', true, 0),
  'queued', 'a retryable failure with attempts left is queued'
);
select is(
  public.fail_job((select job_id from public.claim_jobs('w1', array['analysis_snapshot'], 1, 60)),
    2, 'provider_error', 'upstream 500', true, 0),
  'failed', 'a retryable failure with no attempts left is terminal'
);
select lives_ok(
  $$select * from public.claim_jobs('w1', array['document_embedding'], 1, 60)$$,
  'the single-attempt job is claimed'
);
update public.processing_jobs set lease_expires_at = clock_timestamp() - interval '1 second'
where idempotency_key = 'document_embedding:1665704:embed_v1';
select is_empty(
  $$select * from public.claim_jobs('w2', array['document_embedding'], 1, 60)$$,
  'an expired job with no attempts left is not claimed again'
);
select results_eq(
  $$select j.status, j.last_error_code, a.outcome from public.processing_jobs j
    join public.processing_job_attempts a on a.job_id = j.id
    where j.idempotency_key = 'document_embedding:1665704:embed_v1'$$,
  $$values ('failed'::text, 'lease_expired'::text, 'lease_expired'::text)$$,
  'it fails terminally and records the lost attempt'
);
select is_empty(
  $$select * from public.claim_jobs('w3', array['financial_report_parse', 'analysis_snapshot', 'document_embedding'], 50, 60)$$,
  'terminal jobs are never claimed'
);

-- History cannot be rewritten or removed.
select throws_ok(
  $$update public.processing_job_attempts set outcome = 'succeeded' where outcome = 'failed'$$,
  '23001', null, 'a closed attempt cannot be changed'
);
select throws_ok(
  $$delete from public.processing_job_attempts$$,
  '23001', null, 'attempts cannot be deleted'
);
select throws_ok(
  $$delete from public.processing_jobs$$,
  '23001', null, 'jobs cannot be deleted'
);

-- Authority: users have nothing; machine authority writes only through functions.
set local role authenticated;
select throws_ok(
  $$select * from public.processing_jobs$$,
  '42501', null, 'authenticated users cannot read jobs'
);
select throws_ok(
  $$select * from public.claim_jobs('user', array['metric_recalculation'], 1, 60)$$,
  '42501', null, 'authenticated users cannot claim jobs'
);
reset role;
set local role service_role;
select throws_ok(
  $$update public.processing_jobs set status = 'succeeded'$$,
  '42501', null, 'machine authority cannot write jobs directly'
);
reset role;

select * from finish();
rollback;
