begin;
select plan(46);

-- Issuers A, B, C. A has a listed class (a1) and a privileged class (a2) that MKK
-- reports under the same exchange code, as observed for AVOD in the 02.01 evidence.
insert into public.issuers (id, legal_name) values
  ('00000000-0000-0000-0000-00000000000a', 'Issuer A'),
  ('00000000-0000-0000-0000-00000000000b', 'Issuer B'),
  ('00000000-0000-0000-0000-00000000000c', 'Issuer C');
insert into public.securities (id, issuer_id, kind, share_group) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'share', 'B'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', 'share', 'A'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', 'share', 'B'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000c', 'share', null);

select has_table('public', 'issuers', 'issuers table exists');
select has_table('public', 'securities', 'securities table exists');
select has_table('public', 'issuer_identifiers', 'issuer identifiers table exists');
select has_table('public', 'security_identifiers', 'security identifiers table exists');
select has_table('public', 'identity_review_items', 'identity review items table exists');

-- ISIN: one security per value, one value per security, at any time.
select lives_ok(
  $$insert into public.security_identifiers (security_id, scheme, value, valid_from, valid_from_basis, source)
    values ('00000000-0000-0000-0000-0000000000a1', 'isin', 'TREAVOD00018', '2023-01-01', 'first_observed', 'kap:memberSecurities')$$,
  'ISIN maps to a security; issuer is filled from the security'
);
select is(
  (select issuer_id from public.security_identifiers where value = 'TREAVOD00018'),
  '00000000-0000-0000-0000-00000000000a'::uuid, 'issuer copied from security'
);
select throws_ok(
  $$insert into public.security_identifiers (security_id, scheme, value, valid_from, valid_from_basis, source)
    values ('00000000-0000-0000-0000-0000000000b1', 'isin', 'TREAVOD00018', '2023-06-01', 'first_observed', 'kap:memberSecurities')$$,
  '23P01', null, 'an ISIN cannot name two securities at the same time'
);
select throws_ok(
  $$insert into public.security_identifiers (security_id, scheme, value, valid_from, valid_from_basis, source)
    values ('00000000-0000-0000-0000-0000000000a1', 'isin', 'TREAVOD00026', '2023-06-01', 'first_observed', 'kap:memberSecurities')$$,
  '23P01', null, 'a security cannot hold two ISINs at the same time'
);
select throws_ok(
  $$insert into public.security_identifiers (security_id, issuer_id, scheme, value, valid_from, valid_from_basis, source)
    values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000b', 'isin', 'TREAVOD00026', '2023-01-01', 'first_observed', 'kap:memberSecurities')$$,
  '23503', null, 'a mapping cannot claim an issuer other than its security''s'
);

-- Exchange code shared by two classes of one issuer: stored, but resolution is ambiguous.
select lives_ok(
  $$insert into public.security_identifiers (security_id, scheme, value, valid_from, valid_from_basis, source) values
    ('00000000-0000-0000-0000-0000000000a1', 'bist_code', 'AVOD', '2023-01-01', 'first_observed', 'kap:memberSecurities'),
    ('00000000-0000-0000-0000-0000000000a2', 'bist_code', 'AVOD', '2023-01-01', 'first_observed', 'kap:memberSecurities')$$,
  'classes of one issuer may share an exchange code'
);
select results_eq(
  $$select status, issuer_id, security_ids from public.resolve_security('bist_code', 'AVOD', '2023-05-01')$$,
  $$values ('ambiguous', '00000000-0000-0000-0000-00000000000a'::uuid,
    array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2']::uuid[])$$,
  'shared code resolves to ambiguous with every candidate, never a chosen security'
);
select results_eq(
  $$select status, issuer_id from public.resolve_issuer('bist_code', 'AVOD', '2023-05-01')$$,
  $$values ('resolved', '00000000-0000-0000-0000-00000000000a'::uuid)$$,
  'the same code still resolves to exactly one issuer'
);
select throws_ok(
  $$insert into public.security_identifiers (security_id, scheme, value, valid_from, valid_from_basis, source)
    values ('00000000-0000-0000-0000-0000000000b1', 'bist_code', 'AVOD', '2023-12-01', 'first_observed', 'kap:memberSecurities')$$,
  '23P01', null, 'an exchange code cannot belong to two issuers at the same time'
);

-- Ticker reuse: A's code ends, B takes it over on the next day.
select lives_ok(
  $$update public.security_identifiers set valid_to = '2024-01-01'
    where scheme = 'bist_code' and value = 'AVOD'$$,
  'an open mapping interval can be closed'
);
select lives_ok(
  $$insert into public.security_identifiers (security_id, scheme, value, valid_from, valid_from_basis, source)
    values ('00000000-0000-0000-0000-0000000000b1', 'bist_code', 'AVOD', '2024-01-01', 'source_effective_date', 'kap:memberSecurities')$$,
  'another issuer can reuse a code after the previous interval ends'
);
select results_eq(
  $$select issuer_id from public.resolve_issuer('bist_code', 'AVOD', '2023-12-31')$$,
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid)$$,
  'the last day of the old interval resolves to the old issuer'
);
select results_eq(
  $$select status, issuer_id, security_ids from public.resolve_security('bist_code', 'AVOD', '2024-01-01')$$,
  $$values ('resolved', '00000000-0000-0000-0000-00000000000b'::uuid, array['00000000-0000-0000-0000-0000000000b1']::uuid[])$$,
  'the first day of the new interval resolves to the new issuer''s security'
);

-- Ticker change of one security.
select lives_ok(
  $$insert into public.security_identifiers (security_id, scheme, value, valid_from, valid_to, valid_from_basis, source) values
    ('00000000-0000-0000-0000-0000000000c1', 'bist_code', 'OLDC', '2023-01-01', '2024-03-01', 'first_observed', 'kap:memberSecurities'),
    ('00000000-0000-0000-0000-0000000000c1', 'bist_code', 'NEWC', '2024-03-01', null, 'source_effective_date', 'kap:memberSecurities')$$,
  'a security can change code at an effective date'
);
select throws_ok(
  $$insert into public.security_identifiers (security_id, scheme, value, valid_from, valid_from_basis, source)
    values ('00000000-0000-0000-0000-0000000000c1', 'bist_code', 'THIRD', '2024-02-01', 'first_observed', 'kap:memberSecurities')$$,
  '23P01', null, 'a security cannot hold two exchange codes at the same time'
);
select is((select status from public.resolve_security('bist_code', 'OLDC', '2024-03-01')), 'unknown',
  'the old code no longer resolves after the change');
select is(
  (select security_ids[1] from public.resolve_security('bist_code', 'NEWC', '2024-03-01')),
  '00000000-0000-0000-0000-0000000000c1'::uuid, 'the new code resolves to the same security'
);
select is((select status from public.resolve_security('bist_code', 'NEWC', '2022-12-31')), 'unknown',
  'dates before the first mapping resolve as unknown, not guessed');
select is((select status from public.resolve_issuer('bist_code', 'NOPE', '2024-01-01')), 'unknown',
  'an unmapped code resolves as unknown');

-- Issuer/security join through a code.
select results_eq(
  $$select i.legal_name, s.share_group
    from public.resolve_security('bist_code', 'NEWC', '2024-06-01') r
    join public.securities s on s.id = any (r.security_ids)
    join public.issuers i on i.id = s.issuer_id$$,
  $$values ('Issuer C', null::text)$$,
  'a code joins to its security and issuer'
);

-- Issuer identifiers.
select lives_ok(
  $$insert into public.issuer_identifiers (issuer_id, scheme, value, valid_from, valid_from_basis, source) values
    ('00000000-0000-0000-0000-00000000000a', 'kap_member_id', '1564', '2023-01-01', 'first_observed', 'kap:members'),
    ('00000000-0000-0000-0000-00000000000a', 'kap_member_code', 'A1CAP', '2023-01-01', 'first_observed', 'kap:members'),
    ('00000000-0000-0000-0000-00000000000a', 'kap_member_code', 'ACP', '2023-01-01', 'first_observed', 'kap:members')$$,
  'an issuer has one member id and may hold several member codes'
);
select throws_ok(
  $$insert into public.issuer_identifiers (issuer_id, scheme, value, valid_from, valid_from_basis, source)
    values ('00000000-0000-0000-0000-00000000000a', 'kap_member_id', '1565', '2023-06-01', 'first_observed', 'kap:members')$$,
  '23P01', null, 'an issuer cannot hold two KAP member ids at the same time'
);
select throws_ok(
  $$insert into public.issuer_identifiers (issuer_id, scheme, value, valid_from, valid_from_basis, source)
    values ('00000000-0000-0000-0000-00000000000b', 'kap_member_id', '1564', '2023-06-01', 'first_observed', 'kap:members')$$,
  '23P01', null, 'a KAP member id cannot name two issuers at the same time'
);
select throws_ok(
  $$insert into public.issuer_identifiers (issuer_id, scheme, value, valid_from, valid_from_basis, source)
    values ('00000000-0000-0000-0000-00000000000a', 'kap_member_id', '1564', '2023-06-01', 'first_observed', 'kap:members')$$,
  '23P01', null, 'a duplicate overlapping mapping is rejected'
);
select results_eq(
  $$select status, issuer_id from public.resolve_issuer('kap_member_code', 'ACP', '2024-01-01')$$,
  $$values ('resolved', '00000000-0000-0000-0000-00000000000a'::uuid)$$,
  'a member code resolves to its issuer'
);

-- Values are stored as reported and validated by shape, never repaired.
select throws_ok(
  $$insert into public.security_identifiers (security_id, scheme, value, valid_from, valid_from_basis, source)
    values ('00000000-0000-0000-0000-0000000000b1', 'mkk_clearing_code', 'avod', '2023-01-01', 'first_observed', 'kap:memberSecurities')$$,
  '23514', null, 'a lower-case code is rejected, not case-folded'
);
select throws_ok(
  $$insert into public.issuer_identifiers (issuer_id, scheme, value, valid_from, valid_to, valid_from_basis, source)
    values ('00000000-0000-0000-0000-00000000000c', 'kap_member_code', 'CCC', '2023-01-01', '2023-01-01', 'first_observed', 'kap:members')$$,
  '23514', null, 'an empty validity interval is rejected'
);
select lives_ok(
  $$insert into public.security_identifiers (security_id, scheme, value, valid_from, valid_from_basis, source)
    values ('00000000-0000-0000-0000-0000000000b1', 'isin', 'TRETIKBN0010', '2023-01-01', 'first_observed', 'kap:memberSecurities')$$,
  'an MKK-reported ISIN with a failing check digit is kept as reported'
);
select ok(
  public.isin_check_digit_is_valid('TREAVOD00018') and not public.isin_check_digit_is_valid('TRETIKBN0010'),
  'the check digit function identifies the anomaly for flagging'
);
select throws_ok(
  $$select * from public.resolve_security('ticker', 'AVOD', '2024-01-01')$$,
  '22023', null, 'an unsupported scheme is an error, not an empty result'
);

-- Append-only mappings and permanent entities.
select throws_ok(
  $$update public.security_identifiers set value = 'NEWD' where value = 'NEWC'$$,
  '23001', null, 'a mapping value cannot be rewritten'
);
select throws_ok(
  $$update public.security_identifiers set valid_to = '2025-01-01' where value = 'OLDC'$$,
  '23001', null, 'a closed interval cannot be changed'
);
select throws_ok(
  $$delete from public.issuer_identifiers where value = 'ACP'$$,
  '23001', null, 'a mapping cannot be deleted'
);
select lives_ok(
  $$update public.issuer_identifiers set withdrawn_at = now(), withdrawal_reason = 'mapped to the wrong issuer'
    where value = 'ACP'$$,
  'an erroneous mapping is withdrawn'
);
select is((select status from public.resolve_issuer('kap_member_code', 'ACP', '2024-01-01')), 'unknown',
  'a withdrawn mapping no longer resolves');
select throws_ok(
  $$update public.securities set issuer_id = '00000000-0000-0000-0000-00000000000b'
    where id = '00000000-0000-0000-0000-0000000000c1'$$,
  '23001', null, 'a security cannot change issuer'
);
select throws_ok(
  $$delete from public.issuers where id = '00000000-0000-0000-0000-00000000000c'$$,
  '23001', null, 'an issuer cannot be deleted'
);

-- Unresolved identities are recorded once per open reason.
insert into public.identity_review_items (scheme, value, reason, observed_on, source, context)
values ('bist_code', 'DJIST', 'unknown', '2023-06-01', 'kap:disclosureDetail', '{"disclosureIndex": "1125665"}');
select throws_ok(
  $$insert into public.identity_review_items (scheme, value, reason, observed_on, source)
    values ('bist_code', 'DJIST', 'unknown', '2023-06-02', 'kap:disclosureDetail')$$,
  '23505', null, 'an unresolved identifier has one open review item per reason'
);

-- No user or anonymous access to reference data or resolution.
set local role authenticated;
set local request.jwt.claims = '{"sub":"user_aaa","role":"authenticated"}';
select throws_ok($$select * from public.issuers$$, '42501', null, 'signed-in users cannot read issuers directly');
select throws_ok(
  $$select * from public.resolve_issuer('bist_code', 'AVOD', '2024-01-01')$$,
  '42501', null, 'signed-in users cannot call resolution directly'
);
set local role anon;
set local request.jwt.claims = '{}';
select throws_ok(
  $$insert into public.issuers (legal_name) values ('Anon')$$,
  '42501', null, 'anonymous users cannot write issuers'
);

select * from finish();
rollback;
