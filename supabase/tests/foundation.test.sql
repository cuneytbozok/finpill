begin;
select plan(5);
select is(current_database(), 'postgres', 'connected to local Supabase Postgres');
select has_schema('auth', 'Supabase base schema is present');
select has_role('authenticated', 'Supabase authenticated role is present');
select ok(
  exists(select 1 from supabase_migrations.schema_migrations where name = 'foundation_baseline'),
  'baseline migration was replayed'
);
select is(to_regclass('public.finpill_disposable_probe'), null::regclass,
  'reset removed the disposable replay probe');
select * from finish();
rollback;
