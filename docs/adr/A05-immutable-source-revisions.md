# A05 — Immutable source revisions

- Status: **Proposed 2026-09-25** (task 02.03). The owner accepts it by merging the 02.03 PR.
- Owner: project owner; 03.03/03.04 own KAP acquisition, 02.06/02.07 job attempts and machine authority.
- Implements: blueprint §2.2 and §12.0 "Immutable sources" (BC-05). Migration `20260925180000_immutable_source_revisions.sql`; tests `supabase/tests/immutable_source_revisions.test.sql`, `supabase/tests/source_revisions_concurrency.test.sql`, `tests/source-store.test.ts`; code `apps/api/src/server/sources/`.

## Context

The 02.01 evidence pack ([KAP_FIXTURES.md](../KAP_FIXTURES.md)) shows that one disclosure is served in several representations (`fileType=data`, `html`, `pdf`) and subreport scopes (`subReportList`), that "not found" and validation errors arrive as HTTP 400 bodies, that attachments are Java-serialized `byte[]` wrappers around a PDF, that list and directory responses change over time, and that disclosures can later be blocked for personal data. Parsing rules will change (04.x); the bytes KAP actually sent must stay available and provable.

## Decision

1. **Three layers.** A `source_document` is a logical source identity; a `source_revision` is a distinct body that document served; a `source_acquisition` is one received response. A `source_payload` is one stored body, shared by every revision or acquisition with the same bytes.
2. **Document identity** is `(source, resource, external_key, representation, subreport_scope)`, derived from the request path by `kapSourceIdentity`:
   - `resource` is the KAP endpoint (`disclosure_detail`, `attachment`, `members`, …); unknown endpoints and parameters are rejected, not guessed.
   - `external_key` is the resource id, the name-sorted query string of a list request (values exactly as requested), or `all`.
   - `representation` is the requested `fileType`, `file` for attachments, otherwise `json`.
   - `subreport_scope` is `all`, or the requested `subReportList` exactly as requested.
   - Different representations or scopes are different documents, so their bodies can never become each other's revisions.
3. **Exact bytes in private object storage.** Bodies are stored unmodified (no decoding, re-encoding, unwrapping or normalization) in the private Supabase Storage bucket `source-payloads` under the content-addressed key `sha256/<first two hex>/<sha256>`, as `application/octet-stream`. The database records the SHA-256 and byte length; the key is derived from the hash by a constraint. Derived forms (unwrapped attachment PDF, decoded HTML) are parser outputs, not sources.
4. **Store before parse.** A response is stored and recorded before anything parses it, so a parsing failure never loses the body.
5. **Revisions.** For a 2xx response, a body identical to the document's latest revision is an `unchanged` observation; any other body appends revision *n*+1. A body that returns to an earlier value is a new revision, so the history shows the change back; its bytes are stored once. Non-2xx bodies are `source_error` acquisitions: retained as evidence, never revisions. Requests without a response are job-attempt failures (02.06), not acquisitions.
6. **Append-only.** Triggers reject update, delete and truncate on all four tables. Nothing overwrites a prior revision; corrections arrive as new revisions.
7. **Concurrency.** `record_source_acquisition` creates the document if needed and locks its row, so concurrent acquisitions of one document serialize: identical bodies deduplicate to one revision and changed bodies append gaplessly in commit order. `unique (document_id, revision_number)` is the backstop.
8. **Interrupted writes.** Upload happens before the payload row is recorded, and uploads never replace an object. A retry finds either a recorded hash (upload skipped), an unrecorded object at its key (downloaded, verified byte-for-byte, then recorded) or nothing (uploaded). An object at a content key whose bytes do not match is an integrity failure and is never overwritten. Every read verifies hash and length. An object left by an attempt that is never retried is harmless and reused by the next acquisition of that body.
9. **Authority.** Users and anonymous callers have no access. Machine authority (`service_role`) reads the tables and writes only through `record_source_payload` and `record_source_acquisition`, which enforce the rules above; it has no direct insert, update or delete. Storage deletion by a privileged key cannot be prevented from the database; it is detected by verification on read, and recovery is re-acquisition as a new, verified observation, never a silent substitution.
10. **Requests are recorded without credentials.** An acquisition stores the path and query relative to the source base URL, the request and receipt times, HTTP status and content type. Hosts, authentication headers and tokens are never stored; the path constraint rejects hosts and user info.
11. **Blocked disclosures.** Owner decision (2026-09-25): copies acquired before KAP blocks a disclosure or attachment are retained, because they were published. `/blockedDisclosures` responses are stored as source documents like any other. 03.03 records the blocked status as an append-only observation linked to the affected documents, and no user-facing or AI surface serves a blocked item's raw body. Raw payloads, which can contain personal data (`memberDetail`, KPY41), are never served to users directly.

## Consequences

- Parsers (04.x) take a revision id and read verified bytes; facts carry the source revision id (BC-06).
- Job attempts (02.06) link to acquisitions; 03.03/03.04 build requests through `kapSourceIdentity` and call `acquireSource`.
- Production needs the private `source-payloads` bucket (same settings as `supabase/config.toml`: private, 50 MiB limit, `application/octet-stream` only) before the first Production acquisition. Creating it is an owner-approved Production configuration change; `createSupabaseSourceStore` fails closed if it is missing or public.
- Storage grows with every distinct body; nothing is deleted. Retention or cold storage, if ever needed, is a later ADR.
- Adding a source or resource is a migration (the check lists) plus an identity mapper.
