begin;
select plan(38);

select has_table('public', 'source_payloads', 'source payloads table exists');
select has_table('public', 'source_documents', 'source documents table exists');
select has_table('public', 'source_revisions', 'source revisions table exists');
select has_table('public', 'source_acquisitions', 'source acquisitions table exists');

-- Payloads: content-addressed, idempotent, never re-recorded with another length.
select is(
  public.record_source_payload(repeat('a', 64), 10),
  'sha256/aa/' || repeat('a', 64),
  'a payload is recorded under its content-addressed key'
);
select lives_ok(
  $$select public.record_source_payload(repeat('a', 64), 10)$$,
  'recording the same payload again is a no-op'
);
select throws_ok(
  $$select public.record_source_payload(repeat('a', 64), 11)$$,
  '23000', null, 'a known hash with a different length is an integrity failure'
);
select throws_ok(
  $$select public.record_source_payload('ABC', 3)$$,
  '23514', null, 'a malformed hash is rejected'
);
select throws_ok(
  $$insert into public.source_payloads (sha256, byte_length, storage_key)
    values (repeat('c', 64), 1, 'sha256/cc/other')$$,
  '23514', null, 'the object key must be derived from the hash'
);
select lives_ok(
  $$select public.record_source_payload(h, 1) from unnest(array[repeat('b', 64), repeat('d', 64), repeat('e', 64)]) h$$,
  'further payloads recorded'
);

-- First acquisition creates the document and revision 1.
select results_eq(
  $$select outcome, revision_number from public.record_source_acquisition(
      'kap_vyk', 'disclosure_detail', '1230809', 'data', 'all',
      '/disclosureDetail/1230809?fileType=data', '2026-09-25 10:00:00+00', '2026-09-25 10:00:01+00',
      200, 'application/json', repeat('a', 64))$$,
  $$values ('new_revision', 1)$$,
  'first body of a document is revision 1'
);
-- An identical retry deduplicates.
select results_eq(
  $$select outcome, revision_number from public.record_source_acquisition(
      'kap_vyk', 'disclosure_detail', '1230809', 'data', 'all',
      '/disclosureDetail/1230809?fileType=data', '2026-09-25 10:05:00+00', '2026-09-25 10:05:01+00',
      200, 'application/json', repeat('a', 64))$$,
  $$values ('unchanged', 1)$$,
  'an identical body is an observation of the current revision'
);
-- A changed body appends a revision; the earlier one is untouched.
select results_eq(
  $$select outcome, revision_number from public.record_source_acquisition(
      'kap_vyk', 'disclosure_detail', '1230809', 'data', 'all',
      '/disclosureDetail/1230809?fileType=data', '2026-09-26 10:00:00+00', '2026-09-26 10:00:01+00',
      200, 'application/json', repeat('b', 64))$$,
  $$values ('new_revision', 2)$$,
  'a changed body appends revision 2'
);
-- A body that returns to an earlier value is recorded as a further change.
select results_eq(
  $$select outcome, revision_number from public.record_source_acquisition(
      'kap_vyk', 'disclosure_detail', '1230809', 'data', 'all',
      '/disclosureDetail/1230809?fileType=data', '2026-09-27 10:00:00+00', '2026-09-27 10:00:01+00',
      200, 'application/json', repeat('a', 64))$$,
  $$values ('new_revision', 3)$$,
  'a reverted body is revision 3, not a rewrite of history'
);
select results_eq(
  $$select r.revision_number, r.payload_sha256, r.first_observed_at
    from public.source_revisions r join public.source_documents d on d.id = r.document_id
    where d.external_key = '1230809' and d.representation = 'data' and d.subreport_scope = 'all'
    order by r.revision_number$$,
  $$values (1, repeat('a', 64), '2026-09-25 10:00:01+00'::timestamptz),
           (2, repeat('b', 64), '2026-09-26 10:00:01+00'::timestamptz),
           (3, repeat('a', 64), '2026-09-27 10:00:01+00'::timestamptz)$$,
  'revision history is complete and ordered'
);
select is(
  (select count(*)::integer from public.source_acquisitions a join public.source_documents d on d.id = a.document_id
   where d.external_key = '1230809' and d.representation = 'data' and d.subreport_scope = 'all'),
  4, 'every received response is an acquisition'
);

-- Representation and subreport variants are separate documents and cannot collide.
select results_eq(
  $$select outcome, revision_number from public.record_source_acquisition(
      'kap_vyk', 'disclosure_detail', '1230809', 'html', 'all',
      '/disclosureDetail/1230809?fileType=html', '2026-09-25 11:00:00+00', '2026-09-25 11:00:01+00',
      200, 'application/json', repeat('d', 64))$$,
  $$values ('new_revision', 1)$$,
  'the html representation is its own document'
);
select results_eq(
  $$select outcome, revision_number from public.record_source_acquisition(
      'kap_vyk', 'disclosure_detail', '1230809', 'data', 'general_role_210015',
      '/disclosureDetail/1230809?fileType=data&subReportList=general_role_210015',
      '2026-09-25 11:00:00+00', '2026-09-25 11:00:01+00', 200, 'application/json', repeat('a', 64))$$,
  $$values ('new_revision', 1)$$,
  'a subreport-scoped request is its own document, even with an identical body'
);
select is(
  (select count(*)::integer from public.source_documents where external_key = '1230809'),
  3, 'three documents for one disclosure'
);
select is(
  (select count(*)::integer from public.source_payloads where sha256 = repeat('a', 64)),
  1, 'an identical body shared by documents is stored once'
);

-- Source errors are retained as evidence but never become revisions.
select results_eq(
  $$select outcome, revision_id from public.record_source_acquisition(
      'kap_vyk', 'disclosure_detail', '9999999', 'data', 'all',
      '/disclosureDetail/9999999?fileType=data', '2026-09-25 12:00:00+00', '2026-09-25 12:00:01+00',
      400, 'application/json', repeat('e', 64))$$,
  $$values ('source_error', null::bigint)$$,
  'a 400 response is a source error without a revision'
);
select is(
  (select count(*)::integer from public.source_revisions r join public.source_documents d on d.id = r.document_id
   where d.external_key = '9999999'),
  0, 'an error body creates no revision'
);

-- Acquisitions must reference a stored payload and a well-formed request.
select throws_ok(
  $$select * from public.record_source_acquisition(
      'kap_vyk', 'disclosure_detail', '1230809', 'data', 'all',
      '/disclosureDetail/1230809?fileType=data', '2026-09-25 10:00:00+00', '2026-09-25 10:00:01+00',
      200, 'application/json', repeat('f', 64))$$,
  '23503', null, 'a body that was not stored cannot be acquired'
);
select throws_ok(
  $$select * from public.record_source_acquisition(
      'kap_vyk', 'disclosure_detail', '1230809', 'data', 'all',
      'https://user:pass@apigwdev.mkk.com.tr/api/vyk/members', '2026-09-25 10:00:00+00', '2026-09-25 10:00:01+00',
      200, 'application/json', repeat('a', 64))$$,
  '23514', null, 'a request with a host or credentials is rejected'
);
select throws_ok(
  $$select * from public.record_source_acquisition(
      'kap_vyk', 'unknown_resource', '1', 'data', 'all',
      '/unknown/1', '2026-09-25 10:00:00+00', '2026-09-25 10:00:01+00',
      200, 'application/json', repeat('a', 64))$$,
  '23514', null, 'an unknown resource is rejected'
);
select throws_ok(
  $$select * from public.record_source_acquisition(
      'kap_vyk', 'disclosure_detail', '1230809', 'data', 'all',
      '/disclosureDetail/1230809?fileType=data', '2026-09-25 10:00:02+00', '2026-09-25 10:00:01+00',
      200, 'application/json', repeat('a', 64))$$,
  '23514', null, 'a response cannot precede its request'
);
select throws_ok(
  $$insert into public.source_acquisitions (document_id, request_path, requested_at, received_at, http_status, payload_sha256, outcome)
    select id, '/members', now(), now(), 200, repeat('a', 64), 'new_revision' from public.source_documents limit 1$$,
  '23514', null, 'a successful acquisition must reference a revision'
);

-- Nothing overwrites or removes a prior record.
select throws_ok(
  $$update public.source_revisions set payload_sha256 = repeat('b', 64) where revision_number = 1$$,
  '23001', null, 'a revision cannot be overwritten'
);
select throws_ok(
  $$delete from public.source_revisions$$,
  '23001', null, 'a revision cannot be deleted'
);
select throws_ok(
  $$update public.source_payloads set byte_length = 99$$,
  '23001', null, 'a payload record cannot be changed'
);
select throws_ok(
  $$update public.source_documents set subreport_scope = 'x'$$,
  '23001', null, 'a document identity cannot be changed'
);
select throws_ok(
  $$delete from public.source_acquisitions$$,
  '23001', null, 'an acquisition cannot be deleted'
);
select throws_ok(
  $$truncate public.source_acquisitions$$,
  '23001', null, 'source tables cannot be truncated'
);

-- Authority: users have no access; machine authority writes only through the functions.
set local role authenticated;
select throws_ok(
  $$select count(*) from public.source_revisions$$,
  '42501', null, 'authenticated users cannot read source revisions'
);
select throws_ok(
  $$select public.record_source_payload(repeat('9', 64), 1)$$,
  '42501', null, 'authenticated users cannot record payloads'
);
reset role;
set local role anon;
select throws_ok(
  $$select count(*) from public.source_payloads$$,
  '42501', null, 'anonymous callers cannot read source payloads'
);
reset role;
set local role service_role;
select throws_ok(
  $$insert into public.source_revisions (document_id, revision_number, payload_sha256, first_observed_at)
    select id, 99, repeat('a', 64), now() from public.source_documents limit 1$$,
  '42501', null, 'machine authority cannot write revisions directly'
);
select results_eq(
  $$select outcome, revision_number from public.record_source_acquisition(
      'kap_vyk', 'members', 'all', 'json', 'all',
      '/members', '2026-09-25 13:00:00+00', '2026-09-25 13:00:01+00',
      200, 'application/json', repeat('d', 64))$$,
  $$values ('new_revision', 1)$$,
  'machine authority records acquisitions through the function'
);
reset role;

select * from finish();
rollback;
