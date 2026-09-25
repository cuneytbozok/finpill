# A04 — Issuer/security identity

- Status: **Proposed 2026-09-25** (task 02.02). The owner accepts it by merging the 02.02 PR.
- Owner: project owner; 03.02 owns directory synchronization, 03.03 disclosure associations, 06.01/06.02 market mappings.
- Implements: blueprint §12.0 "Issuer vs security identity" (BC-04). Migration `20260925120000_issuer_security_identity.sql`; tests `supabase/tests/issuer_security_identity.test.sql`.

## Context

The 02.01 evidence pack ([KAP_FIXTURES.md](../KAP_FIXTURES.md)) shows that no KAP or MKK code is a stable key:

- `/members` codes (`stockCode`) are a comma list mixing equity, share-class, debt and intermediary codes (`A1CAP, ACP`); 119 members have none; 23 member ids appear twice.
- `/memberSecurities` lists 1,062 securities of 671 issuers. ISINs are unique, but **285 exchange codes (`borsaKodu`) name several ISINs of one issuer**, usually a listed class and a non-trading privileged class (`AVOD`). One code, `ISDMR`, names two ISINs that are both open for trading. No code spans two issuers. 202 exchange codes (e.g. `BINH1`) are absent from the member's `stockCode` list.
- MKK is Turkey's ISIN numbering agency, and one reported ISIN (`TRETIKBN0010`) fails the ISO 6166 check digit.
- A disclosure has one publishing member (list `companyId`, equal to `behalfSenderId` in all 133 sampled details; `senderId` differs when KAP sends on a member's behalf). Its `relatedStocks` codes often name *other* issuers' securities: Borsa İstanbul and MKK announcements list many companies, and some codes (`DJIST`, `GLDTR`) are not in the member directory.

## Decision

1. **Stable internal identity.** `issuers` (KAP members) and `securities` have UUID primary keys that never change. A security belongs to exactly one issuer for its lifetime; neither row is ever deleted. A security's kind is `share` or `fund_unit`; its source share group is kept as reported.
2. **Every external identifier is an effective-dated mapping.** `issuer_identifiers` holds `kap_member_id`, `kap_member_code` and `mkk_member_id`; `security_identifiers` holds `isin`, `bist_code` (exchange code, the product "ticker") and `mkk_clearing_code`. Validity is a date interval `[valid_from, valid_to)`, open when `valid_to` is null.
3. **Constraint semantics, enforced by exclusion constraints:**
   - An ISIN names one security at a time; an issuer identifier value names one issuer at a time.
   - A security holds one value per scheme at a time; an issuer holds one member id at a time but may hold several member codes.
   - Exchange and clearing codes may be shared by securities **of one issuer** but never by two issuers at the same time.
   - Reuse after an interval ends (ticker reuse or change) is allowed; adjacent intervals do not overlap.
4. **No guessing.** Resolution (`resolve_security`, `resolve_issuer`) returns `resolved`, `ambiguous` (with every candidate) or `unknown`. A shared code resolves to one issuer but is an ambiguous security; callers that need a security (prices, share counts) must use a disambiguating identifier (ISIN or a provider mapping) or report the ambiguity. Unsupported schemes are errors, not empty results.
5. **Honest intervals.** `valid_from_basis` records whether the start came from a source's effective date or only from the first observation. Dates before a first observation resolve as `unknown`; earlier history is added as a separate, adjacent row when a source proves it.
6. **Values as reported.** Values are validated by shape (upper-case ASCII codes, ISO 6166 ISIN shape) and stored exactly as received, never trimmed, case-folded or repaired. The ISIN check digit is not enforced; `isin_check_digit_is_valid` lets synchronization flag the anomaly.
7. **Append-only mappings.** A mapping row can only be closed once (setting `valid_to`) or withdrawn once (`withdrawn_at` and a reason) when erroneous. Withdrawn rows are ignored by constraints and resolution. Corrections are new rows.
8. **Unresolved identities are recorded.** `identity_review_items` holds identifiers that are `unknown`, `ambiguous`, in `conflict` or a `source_anomaly`, with the source and context, one open item per identifier and reason. Synchronization records them and continues; an operator resolves them (03.06).
9. **Disclosure associations** (tables arrive with the disclosure schema in 03.03). A disclosure links to issuers and securities by role: `publisher` (list `companyId` / `behalfSenderId`, a KAP member id), `sender` when it differs, `fund` (`behalfFundId`) and `related_security` (each `relatedStocks` code). Each link keeps the raw external value and scheme and resolves through the rules above on the disclosure's publication date. An unresolved code stays an unresolved link plus a review item; a related code never makes a disclosure the related issuer's own disclosure.
10. **Prices and share counts attach to securities** (06.01, 06.02). A market-provider symbol becomes a new security-identifier scheme in the migration that introduces the provider.
11. **Authority.** Reference data is written by machine authority (03.02). This migration grants nothing to `anon` or `authenticated`; the task that serves company data adds read access.

## Consequences

- `/company/[ticker]` resolves the ticker as an exchange code to one issuer on the request date, even when the issuer has several classes under that code.
- Directory synchronization (03.02) must map member types, deactivation and ticker changes onto closed intervals and new rows, and record ambiguous or anomalous values as review items.
- Adding a scheme is a migration: the scheme lists, format rules and exclusion constraints change together.
- Share capital (`capital`, `currentCapital`) is not identity and is not stored here; it belongs to 06.02 with provenance. Trading status is a directory observation for 03.02.
