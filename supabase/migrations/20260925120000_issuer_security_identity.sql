-- Issuer/security identity (task 02.02, ADR A04).
--
-- Issuers (KAP members) and securities have stable internal IDs. Every external
-- identifier (KAP member id, member code, ISIN, exchange and clearing codes) is an
-- effective-dated mapping, never a key. Resolution reports unknown and ambiguous
-- identities explicitly instead of choosing one.
--
-- Reference data is written by machine authority (03.02). No user or anonymous
-- access is granted here; read access is added by the task that serves it.

create extension if not exists btree_gist with schema extensions;

-- Format rules per identifier scheme. Values are stored exactly as the source
-- reports them: nothing is trimmed, case-folded or repaired.
create function public.identifier_value_is_valid(p_scheme text, p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_scheme
    when 'kap_member_id' then p_value ~ '^[1-9][0-9]{0,11}$'
    when 'kap_member_code' then p_value ~ '^[A-Z0-9]{1,12}$'
    when 'mkk_member_id' then p_value ~ '^[A-Z0-9]{1,24}$'
    -- ISO 6166 shape only. The check digit is not enforced: MKK is the Turkish
    -- numbering agency and at least one reported ISIN fails it (see A04).
    when 'isin' then p_value ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'
    when 'bist_code' then p_value ~ '^[A-Z0-9]{1,12}$'
    when 'mkk_clearing_code' then p_value ~ '^[A-Z0-9]{1,12}$'
    else false
  end
$$;

-- ISO 6166 check digit, for flagging source anomalies (never for rejecting them).
create function public.isin_check_digit_is_valid(p_isin text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  digits text := '';
  ch text;
  n integer;
  total integer := 0;
  i integer;
begin
  if p_isin is null or p_isin !~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$' then
    return false;
  end if;
  foreach ch in array regexp_split_to_array(p_isin, '') loop
    if ch ~ '[0-9]' then
      digits := digits || ch;
    else
      digits := digits || (ascii(ch) - 55)::text;
    end if;
  end loop;
  for i in 0 .. char_length(digits) - 1 loop
    n := substr(digits, char_length(digits) - i, 1)::integer;
    if i % 2 = 1 then
      n := n * 2;
      if n > 9 then
        n := n - 9;
      end if;
    end if;
    total := total + n;
  end loop;
  return total % 10 = 0;
end
$$;

create table public.issuers (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null check (char_length(legal_name) between 1 and 500),
  created_at timestamptz not null default now()
);

create table public.securities (
  id uuid primary key default gen_random_uuid(),
  issuer_id uuid not null references public.issuers (id),
  kind text not null check (kind in ('share', 'fund_unit')),
  -- Source share-group letter (MKK `tertipGroup`), as reported; absent for some classes.
  share_group text check (share_group ~ '^[A-Z0-9]{1,8}$'),
  description text check (char_length(description) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (id, issuer_id)
);

create index securities_issuer_idx on public.securities (issuer_id);

-- Shared shape of both mapping tables:
--   valid_from/valid_to  effective dates, [valid_from, valid_to); null valid_to is open.
--   valid_from_basis     'source_effective_date' when a source states when the mapping
--                        began, 'first_observed' when only the first observation is known.
--                        Dates before a first observation resolve as unknown.
--   withdrawn_at/reason  an erroneous row is withdrawn, never deleted or rewritten.

create table public.issuer_identifiers (
  id bigint generated always as identity primary key,
  issuer_id uuid not null references public.issuers (id),
  scheme text not null check (scheme in ('kap_member_id', 'kap_member_code', 'mkk_member_id')),
  value text not null,
  valid_from date not null,
  valid_to date,
  valid_from_basis text not null check (valid_from_basis in ('source_effective_date', 'first_observed')),
  valid_during daterange generated always as (daterange(valid_from, valid_to, '[)')) stored,
  source text not null check (source ~ '^[a-z][a-z0-9_]*:[A-Za-z0-9_./-]{1,120}$'),
  recorded_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  withdrawal_reason text check (char_length(withdrawal_reason) between 1 and 500),
  check (valid_to is null or valid_to > valid_from),
  check ((withdrawn_at is null) = (withdrawal_reason is null)),
  check (public.identifier_value_is_valid(scheme, value)),
  -- A value names at most one issuer at a time; reuse after the interval ends is allowed.
  constraint issuer_identifiers_value_no_overlap exclude using gist (
    scheme with =, value with =, valid_during with &&
  ) where (withdrawn_at is null),
  -- An issuer has one KAP/MKK member id at a time. It may hold several member codes.
  constraint issuer_identifiers_single_member_id exclude using gist (
    issuer_id with =, scheme with =, valid_during with &&
  ) where (withdrawn_at is null and scheme in ('kap_member_id', 'mkk_member_id'))
);

create index issuer_identifiers_issuer_idx on public.issuer_identifiers (issuer_id);

create table public.security_identifiers (
  id bigint generated always as identity primary key,
  security_id uuid not null,
  -- Copied from the security (filled automatically) so code ownership can be constrained.
  issuer_id uuid not null,
  scheme text not null check (scheme in ('isin', 'bist_code', 'mkk_clearing_code')),
  value text not null,
  valid_from date not null,
  valid_to date,
  valid_from_basis text not null check (valid_from_basis in ('source_effective_date', 'first_observed')),
  valid_during daterange generated always as (daterange(valid_from, valid_to, '[)')) stored,
  source text not null check (source ~ '^[a-z][a-z0-9_]*:[A-Za-z0-9_./-]{1,120}$'),
  recorded_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  withdrawal_reason text check (char_length(withdrawal_reason) between 1 and 500),
  foreign key (security_id, issuer_id) references public.securities (id, issuer_id),
  check (valid_to is null or valid_to > valid_from),
  check ((withdrawn_at is null) = (withdrawal_reason is null)),
  check (public.identifier_value_is_valid(scheme, value)),
  -- A security has one value per scheme at a time.
  constraint security_identifiers_single_value exclude using gist (
    security_id with =, scheme with =, valid_during with &&
  ) where (withdrawn_at is null),
  -- An ISIN names exactly one security at a time.
  constraint security_identifiers_isin_no_overlap exclude using gist (
    scheme with =, value with =, valid_during with &&
  ) where (withdrawn_at is null and scheme = 'isin'),
  -- Exchange and clearing codes are shared by share classes of one issuer (MKK reports
  -- e.g. a listed and a privileged class under one code), but never span issuers at the
  -- same time. Ticker reuse by another issuer after the interval ends is allowed.
  constraint security_identifiers_code_single_issuer exclude using gist (
    scheme with =, value with =, valid_during with &&, issuer_id with <>
  ) where (withdrawn_at is null and scheme in ('bist_code', 'mkk_clearing_code'))
);

create index security_identifiers_security_idx on public.security_identifiers (security_id);
create index security_identifiers_lookup_idx on public.security_identifiers (scheme, value);

-- External identifiers that could not be mapped without guessing, and source anomalies.
-- Synchronization records them here and continues; an operator resolves them.
create table public.identity_review_items (
  id bigint generated always as identity primary key,
  scheme text not null check (
    scheme in ('kap_member_id', 'kap_member_code', 'mkk_member_id', 'isin', 'bist_code', 'mkk_clearing_code')
  ),
  -- Raw value as observed; it may be malformed, so only its length is limited.
  value text not null check (char_length(value) between 1 and 64),
  reason text not null check (reason in ('unknown', 'ambiguous', 'conflict', 'source_anomaly')),
  observed_on date not null,
  source text not null check (source ~ '^[a-z][a-z0-9_]*:[A-Za-z0-9_./-]{1,120}$'),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text check (char_length(resolution) between 1 and 500),
  check ((resolved_at is null) = (resolution is null)),
  check (last_seen_at >= first_seen_at)
);

create unique index identity_review_items_open_uidx
  on public.identity_review_items (scheme, value, reason) where resolved_at is null;

-- Stable identity: issuers and securities are never deleted and a security never
-- changes issuer.
create function public.guard_identity_entity() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception '% rows are permanent', tg_table_name using errcode = 'restrict_violation';
  end if;
  if new.id is distinct from old.id then
    raise exception '% id is immutable', tg_table_name using errcode = 'restrict_violation';
  end if;
  if tg_table_name = 'securities' and new.issuer_id is distinct from old.issuer_id then
    raise exception 'a security cannot change issuer' using errcode = 'restrict_violation';
  end if;
  return new;
end
$$;

create trigger issuers_guard before update or delete on public.issuers
  for each row execute function public.guard_identity_entity();
create trigger securities_guard before update or delete on public.securities
  for each row execute function public.guard_identity_entity();

-- Mapping rows are append-only. The only permitted changes are closing an open
-- interval and withdrawing an erroneous row, each exactly once.
create function public.guard_identifier_mapping() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  mutable_columns text[] := array['valid_to', 'valid_during', 'withdrawn_at', 'withdrawal_reason'];
begin
  if tg_op = 'DELETE' then
    raise exception 'identifier mappings are append-only; withdraw the row instead'
      using errcode = 'restrict_violation';
  end if;
  if (to_jsonb(new) - mutable_columns) is distinct from (to_jsonb(old) - mutable_columns) then
    raise exception 'identifier mappings are append-only; only valid_to and withdrawal may be set'
      using errcode = 'restrict_violation';
  end if;
  if old.valid_to is not null and new.valid_to is distinct from old.valid_to then
    raise exception 'a closed identifier interval cannot be changed' using errcode = 'restrict_violation';
  end if;
  if old.withdrawn_at is not null and (
    new.withdrawn_at is distinct from old.withdrawn_at
    or new.withdrawal_reason is distinct from old.withdrawal_reason
  ) then
    raise exception 'a withdrawal cannot be changed' using errcode = 'restrict_violation';
  end if;
  return new;
end
$$;

create function public.fill_security_identifier_issuer() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.issuer_id is null then
    select s.issuer_id into new.issuer_id from public.securities s where s.id = new.security_id;
  end if;
  return new;
end
$$;

create trigger issuer_identifiers_guard before update or delete on public.issuer_identifiers
  for each row execute function public.guard_identifier_mapping();
create trigger security_identifiers_guard before update or delete on public.security_identifiers
  for each row execute function public.guard_identifier_mapping();
create trigger security_identifiers_fill_issuer before insert on public.security_identifiers
  for each row execute function public.fill_security_identifier_issuer();

-- Resolution never chooses. status is 'resolved' (one match), 'ambiguous' (several;
-- all candidates are returned) or 'unknown' (none on that date).

create function public.resolve_security(p_scheme text, p_value text, p_on date)
returns table (status text, issuer_id uuid, security_ids uuid[])
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_scheme is null or p_scheme not in ('isin', 'bist_code', 'mkk_clearing_code') then
    raise exception 'unsupported security identifier scheme: %', p_scheme using errcode = 'invalid_parameter_value';
  end if;
  if p_value is null or p_on is null then
    raise exception 'identifier value and date are required' using errcode = 'null_value_not_allowed';
  end if;
  return query
  with matches as (
    select si.security_id, si.issuer_id
    from public.security_identifiers si
    where si.scheme = p_scheme
      and si.value = p_value
      and si.withdrawn_at is null
      and si.valid_during @> p_on
  )
  select
    case count(*) when 0 then 'unknown' when 1 then 'resolved' else 'ambiguous' end,
    case when count(distinct m.issuer_id) = 1 then (array_agg(m.issuer_id))[1] end,
    coalesce(array_agg(m.security_id order by m.security_id), '{}'::uuid[])
  from matches m;
end
$$;

-- Issuer-level resolution accepts issuer schemes and security schemes; the constraints
-- above guarantee at most one issuer per value and date for every scheme.
create function public.resolve_issuer(p_scheme text, p_value text, p_on date)
returns table (status text, issuer_id uuid)
language plpgsql
stable
set search_path = ''
as $$
declare
  found uuid[];
begin
  if p_value is null or p_on is null then
    raise exception 'identifier value and date are required' using errcode = 'null_value_not_allowed';
  end if;
  if p_scheme in ('kap_member_id', 'kap_member_code', 'mkk_member_id') then
    select coalesce(array_agg(distinct ii.issuer_id), '{}') into found
    from public.issuer_identifiers ii
    where ii.scheme = p_scheme and ii.value = p_value
      and ii.withdrawn_at is null and ii.valid_during @> p_on;
  elsif p_scheme in ('isin', 'bist_code', 'mkk_clearing_code') then
    select coalesce(array_agg(distinct si.issuer_id), '{}') into found
    from public.security_identifiers si
    where si.scheme = p_scheme and si.value = p_value
      and si.withdrawn_at is null and si.valid_during @> p_on;
  else
    raise exception 'unsupported identifier scheme: %', p_scheme using errcode = 'invalid_parameter_value';
  end if;
  return query select
    case cardinality(found) when 0 then 'unknown' when 1 then 'resolved' else 'ambiguous' end,
    case when cardinality(found) = 1 then found[1] end;
end
$$;

alter table public.issuers enable row level security;
alter table public.securities enable row level security;
alter table public.issuer_identifiers enable row level security;
alter table public.security_identifiers enable row level security;
alter table public.identity_review_items enable row level security;

revoke all on public.issuers, public.securities, public.issuer_identifiers,
  public.security_identifiers, public.identity_review_items from anon, authenticated;

-- The pure format functions stay executable: CHECK constraints call them with the
-- writer's privileges.
revoke execute on function
  public.guard_identity_entity(),
  public.guard_identifier_mapping(),
  public.fill_security_identifier_issuer(),
  public.resolve_security(text, text, date),
  public.resolve_issuer(text, text, date)
from public, anon, authenticated;
