-- Concurrent writers, run as two real database sessions through dblink.
--
-- dblink sessions commit independently of this test's transaction, so their rows
-- persist until the disposable database is reset. They use a dedicated document key.
-- The sessions connect over the container network (password authentication, which
-- dblink requires) with the local-only default database password.
begin;
select plan(9);

create extension if not exists dblink with schema extensions;

do $do$ begin perform extensions.dblink_connect(
  'writer_a',
  format('host=%s port=%s dbname=%s user=postgres password=postgres',
    host(inet_server_addr()), inet_server_port(), current_database())
); end $do$;
do $do$ begin perform extensions.dblink_connect(
  'writer_b',
  format('host=%s port=%s dbname=%s user=postgres password=postgres',
    host(inet_server_addr()), inet_server_port(), current_database())
); end $do$;

do $do$ begin perform extensions.dblink_exec('writer_a', $$
  select public.record_source_payload(h, 1)
  from unnest(array[repeat('1', 64), repeat('2', 64), repeat('3', 64)]) h
$$); end $do$;

-- 1. Two writers acquire the same new body of an unseen document at the same time.
do $do$ begin perform extensions.dblink_exec('writer_a', 'begin'); end $do$;
do $do$ begin perform extensions.dblink_exec('writer_a', $$
  select * from public.record_source_acquisition(
    'kap_vyk', 'disclosure_detail', '7000001', 'data', 'all',
    '/disclosureDetail/7000001?fileType=data', '2026-09-25 10:00:00+00', '2026-09-25 10:00:01+00',
    200, 'application/json', repeat('1', 64))
$$); end $do$;
do $do$ begin perform extensions.dblink_send_query('writer_b', $$
  select outcome, revision_number from public.record_source_acquisition(
    'kap_vyk', 'disclosure_detail', '7000001', 'data', 'all',
    '/disclosureDetail/7000001?fileType=data', '2026-09-25 10:00:00+00', '2026-09-25 10:00:02+00',
    200, 'application/json', repeat('1', 64))
$$); end $do$;
do $do$ begin perform pg_sleep(1); end $do$;
select is(extensions.dblink_is_busy('writer_b'), 1, 'the second writer waits for the first');
do $do$ begin perform extensions.dblink_exec('writer_a', 'commit'); end $do$;
select results_eq(
  $$select outcome, revision_number from extensions.dblink_get_result('writer_b')
      as t(outcome text, revision_number integer)$$,
  $$values ('unchanged', 1)$$,
  'the concurrent identical body deduplicates to revision 1'
);
select is_empty(
  $$select * from extensions.dblink_get_result('writer_b') as t(outcome text, revision_number integer)$$,
  'second writer finished'
);

-- 2. Two writers acquire different changed bodies of the same document at the same time.
do $do$ begin perform extensions.dblink_exec('writer_a', 'begin'); end $do$;
do $do$ begin perform extensions.dblink_exec('writer_a', $$
  select * from public.record_source_acquisition(
    'kap_vyk', 'disclosure_detail', '7000001', 'data', 'all',
    '/disclosureDetail/7000001?fileType=data', '2026-09-26 10:00:00+00', '2026-09-26 10:00:01+00',
    200, 'application/json', repeat('2', 64))
$$); end $do$;
do $do$ begin perform extensions.dblink_send_query('writer_b', $$
  select outcome, revision_number from public.record_source_acquisition(
    'kap_vyk', 'disclosure_detail', '7000001', 'data', 'all',
    '/disclosureDetail/7000001?fileType=data', '2026-09-26 10:00:00+00', '2026-09-26 10:00:02+00',
    200, 'application/json', repeat('3', 64))
$$); end $do$;
do $do$ begin perform pg_sleep(1); end $do$;
select is(extensions.dblink_is_busy('writer_b'), 1, 'a writer of another body also waits');
do $do$ begin perform extensions.dblink_exec('writer_a', 'commit'); end $do$;
select results_eq(
  $$select outcome, revision_number from extensions.dblink_get_result('writer_b')
      as t(outcome text, revision_number integer)$$,
  $$values ('new_revision', 3)$$,
  'the second changed body is appended after the first'
);
select is_empty(
  $$select * from extensions.dblink_get_result('writer_b') as t(outcome text, revision_number integer)$$,
  'second writer finished'
);

-- 3. A writer that fails mid-transaction leaves nothing behind; a retry succeeds.
do $do$ begin perform extensions.dblink_exec('writer_a', 'begin'); end $do$;
do $do$ begin perform extensions.dblink_exec('writer_a', $$
  select * from public.record_source_acquisition(
    'kap_vyk', 'disclosure_detail', '7000002', 'data', 'all',
    '/disclosureDetail/7000002?fileType=data', '2026-09-25 10:00:00+00', '2026-09-25 10:00:01+00',
    200, 'application/json', repeat('1', 64))
$$); end $do$;
do $do$ begin perform extensions.dblink_exec('writer_a', 'rollback'); end $do$;

select results_eq(
  $$select r.revision_number, r.payload_sha256
    from public.source_revisions r join public.source_documents d on d.id = r.document_id
    where d.external_key = '7000001' order by r.revision_number$$,
  $$values (1, repeat('1', 64)), (2, repeat('2', 64)), (3, repeat('3', 64))$$,
  'concurrent writers produced one gapless revision sequence'
);
select is(
  (select count(*)::integer from public.source_acquisitions a join public.source_documents d on d.id = a.document_id
   where d.external_key = '7000001'),
  4, 'every concurrent response is an acquisition'
);
select is(
  (select count(*)::integer from public.source_documents where external_key = '7000002'),
  0, 'an interrupted writer leaves no document, revision or acquisition'
);

do $do$ begin perform extensions.dblink_disconnect('writer_a'); end $do$;
do $do$ begin perform extensions.dblink_disconnect('writer_b'); end $do$;

select * from finish();
rollback;
