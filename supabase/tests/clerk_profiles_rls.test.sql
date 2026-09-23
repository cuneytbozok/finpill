begin;
select plan(17);

insert into public.pilot_eligibility (user_id, enabled) values
  ('user_aaa', true), ('user_bbb', true), ('user_uninvited', false);

set local role authenticated;
set local request.jwt.claims = '{"sub":"user_aaa","role":"authenticated"}';

select is((select count(*)::integer from public.pilot_eligibility), 1, 'eligible user sees only own eligibility');
insert into public.user_profiles (user_id, display_name) values ('user_aaa', 'Alice');
select is((select count(*)::integer from public.user_profiles), 1, 'A reads own profile');
select throws_ok(
  $$insert into public.user_profiles (user_id, display_name) values ('user_bbb', 'Imposter')$$,
  '42501', null, 'A cannot create B profile'
);
select throws_ok(
  $$insert into public.pilot_eligibility (user_id, enabled) values ('user_extra', true)$$,
  '42501', null, 'user cannot grant pilot access'
);
select throws_ok(
  $$update public.user_profiles set user_id = 'user_bbb' where user_id = 'user_aaa'$$,
  '42501', null, 'user cannot reassign profile ownership'
);
select is((select count(*)::integer from public.user_profiles where user_id = 'user_bbb'), 0, 'A cannot see B before B creates profile');

set local request.jwt.claims = '{"sub":"user_bbb","role":"authenticated"}';
insert into public.user_profiles (user_id, display_name) values ('user_bbb', 'Bob');
select is((select count(*)::integer from public.user_profiles), 1, 'B sees only B profile');
select is((select count(*)::integer from public.user_profiles where user_id = 'user_aaa'), 0, 'B cannot read A');
select is((select count(*)::integer from public.pilot_eligibility where user_id = 'user_aaa'), 0, 'B cannot read A eligibility');
update public.user_profiles set display_name = 'Changed' where user_id = 'user_aaa';
select is((select display_name from public.user_profiles where user_id = 'user_bbb'), 'Bob', 'B cannot modify A');

set local request.jwt.claims = '{"sub":"user_uninvited","role":"authenticated"}';
select is((select count(*)::integer from public.user_profiles), 0, 'disabled pilot cannot read profiles');
select throws_ok(
  $$insert into public.user_profiles (user_id, display_name) values ('user_uninvited', 'No')$$,
  '42501', null, 'disabled pilot cannot create profile'
);

set local request.jwt.claims = '{"sub":"user_unknown","role":"authenticated"}';
select is((select count(*)::integer from public.pilot_eligibility), 0, 'unknown user has no eligibility');
select throws_ok(
  $$insert into public.user_profiles (user_id, display_name) values ('user_unknown', 'No')$$,
  '42501', null, 'unknown user cannot create profile'
);

set local role anon;
set local request.jwt.claims = '{}';
select throws_ok($$select * from public.user_profiles$$, '42501', null, 'anonymous cannot read profiles');
select throws_ok($$select * from public.pilot_eligibility$$, '42501', null, 'anonymous cannot read eligibility');
select throws_ok(
  $$insert into public.user_profiles (user_id, display_name) values ('user_anon', 'No')$$,
  '42501', null, 'anonymous cannot create profiles'
);

select * from finish();
rollback;
