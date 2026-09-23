-- Pilot access is provisioned by an operator through a privileged database path.
-- A Clerk session alone never grants access to user-owned application data.
create table public.pilot_eligibility (
  user_id text primary key check (user_id ~ '^user_[A-Za-z0-9]+$'),
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.user_profiles (
  user_id text primary key check (user_id ~ '^user_[A-Za-z0-9]+$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pilot_eligibility enable row level security;
alter table public.user_profiles enable row level security;

-- Explicit grants are needed when the Data API does not auto-expose new tables.
revoke all on public.pilot_eligibility from anon, authenticated;
revoke all on public.user_profiles from anon, authenticated;
grant select (user_id, enabled) on public.pilot_eligibility to authenticated;
grant select on public.user_profiles to authenticated;
grant insert (user_id, display_name) on public.user_profiles to authenticated;
grant update (display_name) on public.user_profiles to authenticated;

create policy pilot_eligibility_self_read
  on public.pilot_eligibility for select to authenticated
  using (user_id = (select auth.jwt()->>'sub'));

create policy user_profiles_self_read
  on public.user_profiles for select to authenticated
  using (
    user_id = (select auth.jwt()->>'sub')
    and exists (
      select 1 from public.pilot_eligibility p
      where p.user_id = (select auth.jwt()->>'sub') and p.enabled
    )
  );

create policy user_profiles_self_insert
  on public.user_profiles for insert to authenticated
  with check (
    user_id = (select auth.jwt()->>'sub')
    and exists (
      select 1 from public.pilot_eligibility p
      where p.user_id = (select auth.jwt()->>'sub') and p.enabled
    )
  );

create policy user_profiles_self_update
  on public.user_profiles for update to authenticated
  using (
    user_id = (select auth.jwt()->>'sub')
    and exists (
      select 1 from public.pilot_eligibility p
      where p.user_id = (select auth.jwt()->>'sub') and p.enabled
    )
  )
  with check (
    user_id = (select auth.jwt()->>'sub')
    and exists (
      select 1 from public.pilot_eligibility p
      where p.user_id = (select auth.jwt()->>'sub') and p.enabled
    )
  );
