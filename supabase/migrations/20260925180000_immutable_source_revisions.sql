-- Immutable source revisions (task 02.03, ADR A05).
--
-- A logical source document (one KAP resource in one representation and subreport
-- scope) is separate from the exact bodies it has served (revisions) and from each
-- time it was fetched (acquisitions). Bodies live in the private `source-payloads`
-- Storage bucket under content-addressed keys; this schema records them by SHA-256.
--
-- Everything here is append-only. Writes come from machine authority through
-- record_source_payload and record_source_acquisition; users have no access.

create table public.source_payloads (
  sha256 text primary key check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_length bigint not null check (byte_length >= 0),
  storage_bucket text not null default 'source-payloads' check (storage_bucket = 'source-payloads'),
  storage_key text not null unique,
  stored_at timestamptz not null default now(),
  -- The object key is derived from the hash, so one body has exactly one object.
  check (storage_key = 'sha256/' || substr(sha256, 1, 2) || '/' || sha256)
);

-- A logical source document. Different representations (fileType) and subreport
-- scopes of one disclosure are different documents and can never share revisions.
create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('kap_vyk')),
  resource text not null check (resource in (
    'members', 'member_detail', 'member_securities', 'funds', 'fund_detail',
    'last_disclosure_index', 'disclosure_list', 'disclosure_detail', 'attachment',
    'blocked_disclosures', 'ca_event_status'
  )),
  -- Canonical request key: the resource id, the name-sorted query string of a list
  -- request, or 'all' for a resource without parameters.
  external_key text not null check (external_key ~ '^[A-Za-z0-9_.,:=&-]{1,256}$'),
  -- Source representation as requested (e.g. fileType 'data', 'html', 'pdf'), or
  -- 'json'/'file' for resources that have one.
  representation text not null check (representation ~ '^[a-z][a-z0-9_]{0,31}$'),
  -- 'all' when no subreport filter was requested; otherwise the requested list,
  -- exactly as requested.
  subreport_scope text not null default 'all' check (
    subreport_scope = 'all' or subreport_scope ~ '^[A-Za-z0-9_.-]{1,64}(,[A-Za-z0-9_.-]{1,64}){0,63}$'
  ),
  created_at timestamptz not null default now(),
  unique (source, resource, external_key, representation, subreport_scope)
);

-- A distinct body served for a document. Revision n+1 is appended only when the body
-- differs from revision n; a body that returns to an earlier value is a new revision
-- (the history records the change back), stored once in Storage by its hash.
create table public.source_revisions (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.source_documents (id),
  revision_number integer not null check (revision_number >= 1),
  payload_sha256 text not null references public.source_payloads (sha256),
  first_observed_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  unique (document_id, revision_number)
);

create index source_revisions_payload_idx on public.source_revisions (payload_sha256);

-- Every received response. A 2xx body is either a new revision or an observation of
-- the current one; a non-2xx body is a source error, retained as evidence but never
-- a revision. Requests that received no response are job-attempt failures (02.06).
create table public.source_acquisitions (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.source_documents (id),
  -- Path and query relative to the source base URL. Never a host or credentials.
  request_path text not null check (request_path ~ '^/[A-Za-z0-9_.,:=&?/%+-]{0,1023}$'),
  requested_at timestamptz not null,
  received_at timestamptz not null,
  http_status integer not null check (http_status between 100 and 599),
  content_type text check (char_length(content_type) between 1 and 200),
  payload_sha256 text not null references public.source_payloads (sha256),
  outcome text not null check (outcome in ('new_revision', 'unchanged', 'source_error')),
  revision_id bigint references public.source_revisions (id),
  recorded_at timestamptz not null default now(),
  check (received_at >= requested_at),
  check (
    case outcome
      when 'source_error' then revision_id is null and http_status not between 200 and 299
      else revision_id is not null and http_status between 200 and 299
    end
  )
);

create index source_acquisitions_document_idx on public.source_acquisitions (document_id, received_at);

-- Append-only: no update, delete or truncate on any source table.
create function public.guard_source_append_only() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'restrict_violation';
end
$$;

create trigger source_payloads_append_only before update or delete on public.source_payloads
  for each row execute function public.guard_source_append_only();
create trigger source_documents_append_only before update or delete on public.source_documents
  for each row execute function public.guard_source_append_only();
create trigger source_revisions_append_only before update or delete on public.source_revisions
  for each row execute function public.guard_source_append_only();
create trigger source_acquisitions_append_only before update or delete on public.source_acquisitions
  for each row execute function public.guard_source_append_only();
create trigger source_payloads_no_truncate before truncate on public.source_payloads
  for each statement execute function public.guard_source_append_only();
create trigger source_documents_no_truncate before truncate on public.source_documents
  for each statement execute function public.guard_source_append_only();
create trigger source_revisions_no_truncate before truncate on public.source_revisions
  for each statement execute function public.guard_source_append_only();
create trigger source_acquisitions_no_truncate before truncate on public.source_acquisitions
  for each statement execute function public.guard_source_append_only();

-- Records a body that the caller has already uploaded to its content-addressed key.
-- Idempotent: a retry of the same body is a no-op; a different length for a known
-- hash is an integrity failure, never an overwrite.
create function public.record_source_payload(p_sha256 text, p_byte_length bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  known_length bigint;
begin
  insert into public.source_payloads (sha256, byte_length, storage_key)
  values (p_sha256, p_byte_length, 'sha256/' || substr(p_sha256, 1, 2) || '/' || p_sha256)
  on conflict (sha256) do nothing;
  select sp.byte_length into known_length from public.source_payloads sp where sp.sha256 = p_sha256;
  if known_length is distinct from p_byte_length then
    raise exception 'payload % is already recorded with a different length', p_sha256
      using errcode = 'integrity_constraint_violation';
  end if;
  return 'sha256/' || substr(p_sha256, 1, 2) || '/' || p_sha256;
end
$$;

-- Records one received response for a document, creating the document on first use.
-- The document row is locked, so concurrent acquisitions of one document serialize:
-- identical bodies deduplicate to one revision and changed bodies append in order.
create function public.record_source_acquisition(
  p_source text,
  p_resource text,
  p_external_key text,
  p_representation text,
  p_subreport_scope text,
  p_request_path text,
  p_requested_at timestamptz,
  p_received_at timestamptz,
  p_http_status integer,
  p_content_type text,
  p_payload_sha256 text
)
returns table (
  acquisition_id bigint,
  document_id uuid,
  outcome text,
  revision_id bigint,
  revision_number integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc uuid;
  latest public.source_revisions%rowtype;
  result_outcome text;
  result_revision public.source_revisions%rowtype;
  new_acquisition bigint;
begin
  if p_http_status is null or p_payload_sha256 is null then
    raise exception 'status and payload are required' using errcode = 'null_value_not_allowed';
  end if;

  insert into public.source_documents (source, resource, external_key, representation, subreport_scope)
  values (p_source, p_resource, p_external_key, p_representation, p_subreport_scope)
  on conflict (source, resource, external_key, representation, subreport_scope) do nothing;

  select d.id into strict doc
  from public.source_documents d
  where d.source = p_source and d.resource = p_resource and d.external_key = p_external_key
    and d.representation = p_representation and d.subreport_scope = p_subreport_scope
  for update;

  if p_http_status between 200 and 299 then
    select r.* into latest
    from public.source_revisions r
    where r.document_id = doc
    order by r.revision_number desc
    limit 1;

    if latest.id is not null and latest.payload_sha256 = p_payload_sha256 then
      result_outcome := 'unchanged';
      result_revision := latest;
    else
      result_outcome := 'new_revision';
      insert into public.source_revisions (document_id, revision_number, payload_sha256, first_observed_at)
      values (doc, coalesce(latest.revision_number, 0) + 1, p_payload_sha256, p_received_at)
      returning * into result_revision;
    end if;
  else
    result_outcome := 'source_error';
  end if;

  insert into public.source_acquisitions (
    document_id, request_path, requested_at, received_at, http_status, content_type,
    payload_sha256, outcome, revision_id
  ) values (
    doc, p_request_path, p_requested_at, p_received_at, p_http_status, p_content_type,
    p_payload_sha256, result_outcome, result_revision.id
  )
  returning id into new_acquisition;

  return query select new_acquisition, doc, result_outcome, result_revision.id, result_revision.revision_number;
end
$$;

alter table public.source_payloads enable row level security;
alter table public.source_documents enable row level security;
alter table public.source_revisions enable row level security;
alter table public.source_acquisitions enable row level security;

revoke all on public.source_payloads, public.source_documents, public.source_revisions,
  public.source_acquisitions from public, anon, authenticated, service_role;

revoke execute on function
  public.guard_source_append_only(),
  public.record_source_payload(text, bigint),
  public.record_source_acquisition(text, text, text, text, text, text, timestamptz, timestamptz, integer, text, text)
from public, anon, authenticated, service_role;

-- Machine authority reads the source tables and writes only through the functions.
grant select on public.source_payloads, public.source_documents, public.source_revisions,
  public.source_acquisitions to service_role;
grant execute on function
  public.record_source_payload(text, bigint),
  public.record_source_acquisition(text, text, text, text, text, text, timestamptz, timestamptz, integer, text, text)
to service_role;
