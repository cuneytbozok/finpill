-- Concurrent workers, run as two real database sessions through dblink.
--
-- dblink sessions commit independently of this test's transaction, so their rows
-- persist until the disposable database is reset. They use job types and keys that no
-- other test claims. The sessions connect over the container network (password
-- authentication, which dblink requires) with the local-only default database password.
begin;
select plan(13);

create extension if not exists dblink with schema extensions;

do $do$ begin perform extensions.dblink_connect(
  'worker_a',
  format('host=%s port=%s dbname=%s user=postgres password=postgres',
    host(inet_server_addr()), inet_server_port(), current_database())
); end $do$;
do $do$ begin perform extensions.dblink_connect(
  'worker_b',
  format('host=%s port=%s dbname=%s user=postgres password=postgres',
    host(inet_server_addr()), inet_server_port(), current_database())
); end $do$;

-- 1. Two workers claim at the same time: the second skips the locked job.
do $do$ begin perform extensions.dblink_exec('worker_a', $$do $r$ begin
  perform public.enqueue_job('market_valuation_refresh', 'market_valuation_refresh:conc1:valuation_v1');
end $r$ $$); end $do$;
do $do$ begin perform extensions.dblink_exec('worker_a', 'begin'); end $do$;
select results_eq(
  $$select attempt_number from extensions.dblink('worker_a', $q$
      select attempt_number from public.claim_jobs('worker-a', array['market_valuation_refresh'], 5, 60)
    $q$) as t(attempt_number integer)$$,
  $$values (1)$$,
  'the first worker claims the job inside an open transaction'
);
select is_empty(
  $$select * from extensions.dblink('worker_b', $q$
      select job_id from public.claim_jobs('worker-b', array['market_valuation_refresh'], 5, 60)
    $q$) as t(job_id bigint)$$,
  'a concurrent claimer skips the locked job without waiting'
);
do $do$ begin perform extensions.dblink_exec('worker_a', 'commit'); end $do$;
select is_empty(
  $$select * from extensions.dblink('worker_b', $q$
      select job_id from public.claim_jobs('worker-b', array['market_valuation_refresh'], 5, 60)
    $q$) as t(job_id bigint)$$,
  'after commit the job is leased and still not claimable'
);
select results_eq(
  $$select a.worker_id, a.attempt_number from public.processing_job_attempts a
    join public.processing_jobs j on j.id = a.job_id
    where j.idempotency_key = 'market_valuation_refresh:conc1:valuation_v1'$$,
  $$values ('worker-a'::text, 1)$$,
  'exactly one attempt exists'
);

-- 2. Two dispatchers enqueue the same key at the same time: one job.
do $do$ begin perform extensions.dblink_exec('worker_a', 'begin'); end $do$;
do $do$ begin perform extensions.dblink_exec('worker_a', $$do $r$ begin
  perform public.enqueue_job('kap_disclosure_detail', 'kap_disclosure_detail:7000003:fetch_v1');
end $r$ $$); end $do$;
do $do$ begin perform extensions.dblink_send_query('worker_b', $$
  select created from public.enqueue_job('kap_disclosure_detail', 'kap_disclosure_detail:7000003:fetch_v1')
$$); end $do$;
do $do$ begin perform pg_sleep(1); end $do$;
select is(extensions.dblink_is_busy('worker_b'), 1, 'the second enqueue waits for the first');
do $do$ begin perform extensions.dblink_exec('worker_a', 'commit'); end $do$;
select results_eq(
  $$select created from extensions.dblink_get_result('worker_b') as t(created boolean)$$,
  $$values (false)$$,
  'the concurrent duplicate returns the existing job'
);
select is_empty(
  $$select * from extensions.dblink_get_result('worker_b') as t(created boolean)$$,
  'second enqueue finished'
);
select is(
  (select count(*)::integer from public.processing_jobs where idempotency_key = 'kap_disclosure_detail:7000003:fetch_v1'),
  1, 'concurrent enqueues produced one job'
);

-- 3. A worker publishing under its lock blocks reclaim; once its lease has expired it
--    cannot publish, and the next worker can.
do $do$ begin perform extensions.dblink_exec('worker_a', $$do $r$ begin
  perform public.enqueue_job('market_valuation_refresh', 'market_valuation_refresh:conc3:valuation_v1');
end $r$ $$); end $do$;
do $do$ begin perform extensions.dblink_exec('worker_a', $$do $r$ begin
  perform * from public.claim_jobs('worker-a', array['market_valuation_refresh'], 5, 60);
end $r$ $$); end $do$;
-- Shorten the lease to two seconds (committed, as a test-only direct write).
do $do$ begin perform extensions.dblink_exec('worker_b', $$
  update public.processing_jobs set lease_expires_at = clock_timestamp() + interval '2 seconds'
  where idempotency_key = 'market_valuation_refresh:conc3:valuation_v1'
$$); end $do$;
do $do$ begin perform extensions.dblink_exec('worker_a', 'begin'); end $do$;
do $do$ begin perform extensions.dblink_exec('worker_a', $$do $r$ begin
  perform public.assert_job_lease(
    (select id from public.processing_jobs where idempotency_key = 'market_valuation_refresh:conc3:valuation_v1'), 1);
end $r$ $$); end $do$;
do $do$ begin perform pg_sleep(3); end $do$;
select is_empty(
  $$select * from extensions.dblink('worker_b', $q$
      select job_id from public.claim_jobs('worker-b', array['market_valuation_refresh'], 5, 60)
    $q$) as t(job_id bigint)$$,
  'an expired job cannot be reclaimed while its worker holds the row'
);
select throws_ok(
  $$select extensions.dblink_exec('worker_a', $q$do $r$ begin
      perform public.complete_job(
        (select id from public.processing_jobs where idempotency_key = 'market_valuation_refresh:conc3:valuation_v1'),
        1, '{"published": "a"}');
    end $r$ $q$)$$,
  '55P03', null, 'the worker whose lease expired cannot publish'
);
do $do$ begin perform extensions.dblink_exec('worker_a', 'rollback'); end $do$;
select results_eq(
  $$select attempt_number from extensions.dblink('worker_b', $q$
      select attempt_number from public.claim_jobs('worker-b', array['market_valuation_refresh'], 5, 60)
    $q$) as t(attempt_number integer)$$,
  $$values (2)$$,
  'the next worker reclaims it as attempt 2'
);
do $do$ begin perform extensions.dblink_exec('worker_b', $$do $r$ begin
  perform public.complete_job(
    (select id from public.processing_jobs where idempotency_key = 'market_valuation_refresh:conc3:valuation_v1'),
    2, '{"published": "b"}');
end $r$ $$); end $do$;
select results_eq(
  $$select status, result from public.processing_jobs
    where idempotency_key = 'market_valuation_refresh:conc3:valuation_v1'$$,
  $$values ('succeeded'::text, '{"published": "b"}'::jsonb)$$,
  'only the current lease holder published a result'
);
select results_eq(
  $$select a.attempt_number, a.worker_id, a.outcome from public.processing_job_attempts a
    join public.processing_jobs j on j.id = a.job_id
    where j.idempotency_key = 'market_valuation_refresh:conc3:valuation_v1' order by a.attempt_number$$,
  $$values (1, 'worker-a'::text, 'lease_expired'::text), (2, 'worker-b', 'succeeded')$$,
  'the lost attempt and the successful one are both recorded'
);

do $do$ begin perform extensions.dblink_disconnect('worker_a'); end $do$;
do $do$ begin perform extensions.dblink_disconnect('worker_b'); end $do$;

select * from finish();
rollback;
