# A07 — Financial identity and compatibility

- Status: **Proposed 2026-09-25** (task 02.05). The owner accepts it by merging the 02.05 PR.
- Owner: project owner; 04.01 owns the financial schema, 04.02–04.03 the parser, 04.05 publication, 04.06 quality checks, 05.02 quarter/TTM arithmetic.
- Implements: blueprint §10, §11, §12.0 "Financial identity and publication" and §18 (BC-06, BC-07). Code `packages/contracts/src/financial.ts`; `apps/api/src/server/financial/` (`identity.ts`, `coverage.ts`, `compatibility.ts`, `selection.ts`); tests `tests/financial-identity.test.ts`. No migration: 04.01 turns these rules into tables.

## Context

The 02.01 evidence pack ([KAP_FIXTURES.md](../KAP_FIXTURES.md)) contains 20 financial-report details (general, bank, participation-bank, insurance, finance, holding and ETF taxonomies; consolidated and standalone; December and June–May fiscal years; annual, 6-month and 9-month filings). All come from the frozen MKK **development** snapshot, which may contain test values; they are evidence of response *shapes*, not of any company's real figures. Observed:

- Contexts carry only `id`, `key` (`CURR`, `CURR3`, `PREV`, `PREV3`) and `Period` (`instant`, or `startDate`/`endDate`). Context ids are date strings; **dimensions are not in the context**. They are on each `Value` as `Measures.Measure` (`ComponentsOfEquityAxis`, `CurrencyTypeAxis`).
- Cash-flow and equity statements report balances on a *duration* context, distinguished only by `preferredLabel` (`periodStartLabel`, `tersePeriodStartLabel`, `periodEndLabel`, …). TSPOR's cash-flow opening balance for 2023-06-01…2023-11-30 equals its balance-sheet cash at 2023-05-31.
- Typed-domain values (`ClassesOfShares`, `typedMember: "yes"`) sit on the typed-domain item itself, with no member value; the reported concept is the enclosing item (basic EPS from continuing vs discontinued operations). Per-share values carry `currency: "TRY"`.
- Insurance income statements present the same concept, context and value twice under different parents.
- In two development filings (ISCTR 1110170/1110914) the equity statement's 2021 closing balance and 2022 opening balance of one component differ.
- Filing-level `consolidation` (`CS`/`NC`), `year` (fiscal-year label, e.g. `2023` for TSPOR's June 2023–May 2024 year), `period` (`{tr, en}`, e.g. `6 Months`) and `time` (`29.12.2023 18:28:45`, Istanbul time).
- No TMS 29 filing and no corrected FR filing exist in the development snapshot (recorded gaps).

KGK announced on 2023-11-23 that TFRS reporters apply TMS 29 to annual reporting periods ending on or after 2023-12-31. Sector regulators have deferred application for some entities, so the date alone does not settle a later filing's basis.

## Decision

1. **Periods come from dates.** A context normalizes to an instant or a duration from `Period` alone; exactly one form must be present, dates must be valid and ordered, and nothing is repaired. `key` and the `id` string are kept for lineage only.
2. **Fact identity within a filing build** is `(concept, effective period, temporal role, dimensions, unit)`, plus the build's issuer, scope, source revision and parser build (A05):
   - *Temporal role* comes from `preferredLabel`: a `…PeriodStart…` label on a duration is the balance at the instant before the period starts; `…PeriodEnd…` is the balance on its last day; anything else keeps the context period. The role stays in the key, so a closing balance and the next period's opening balance are separate reported facts even when they share an instant. Whether they agree is a quality check (04.06), never an identity merge.
   - *Dimensions* are the value's measures, sorted by axis. A repeated or malformed axis fails. No default-member inference: a fact without dimensions and the same concept with `EquityMember` are different facts.
   - *Typed-domain values* belong to the enclosing concept with the typed axis and an unidentified member (`null`). They never resolve to a specific security.
   - *Unit* is the source `currency` as reported.
   - Presentation occurrences (subreport, hierarchy path, `preferredLabel`, label texts) are lineage. Occurrences with one identity and identical raw values are one fact. Differing values are a **conflict**: both are kept, neither is selected, and 04.06 reports it.
3. **Reporting scope** is `consolidated` (`CS`) or `standalone` (`NC`). Anything else fails. Scopes are never mixed.
4. **Fiscal coverage** is derived per filing from dates. The *reporting date* is the latest context date. The *fiscal-year start* is the start of the longest duration ending on it, and that duration must be 3, 6, 9 or 12 whole months. The fiscal-year end is 12 months after the start. KAP's `period` label is cross-checked and a disagreement fails the filing. `year` is kept as the source's fiscal-year label and never used as a date. A scope with no duration (a balance-sheet-only subreport request) has no derivable coverage. Irregular (non-whole-month) periods are `irregular_period` and never rounded to a quarter.
5. **Knowledge time** is the source publication time: KAP `time` read as Europe/Istanbul (fixed UTC+03:00 since 2016-09-07) and stored in UTC. Earlier times are rejected until an explicit offset rule exists. Acquisition time (A05) and generation publication time (below) are recorded separately and answer different questions: "what did the market know" versus "what did Finpill show".
6. **Compatibility.** Two reported values may be combined only if, in this order: same issuer (`entity_mismatch`), scope (`scope_mismatch`), concept and dimensions (`concept_mismatch`), unit (`unit_mismatch`), accounting basis, meaning the statement taxonomy family (`accounting_basis_mismatch`), and purchasing-power basis. Values from one filing build share its basis by construction. Across filings:
   - `nominal` combines only with `nominal`;
   - `tms29` carries its measuring-unit date (the filing's reporting date) and combines only with the same date (`measuring_unit_mismatch`), so under TMS 29 a quarter cannot be derived from two filings' cumulative figures;
   - `unknown` combines with nothing (`purchasing_power_basis_unknown`).
7. **Purchasing-power basis of a filing.** A filing whose fiscal year ends before 2023-12-31 is `nominal`. Evidence that TMS 29 was applied to such a filing contradicts the rule and makes it `unknown` for review. A later filing is `tms29` or `nominal` only from recorded evidence (the filing's own statements or notes, or a documented regulator exemption, recorded by 04.x or an operator). Without evidence it is `unknown`. Rebasing factors are never invented.
8. **Standalone quarters.** (A) A reported three-month period with exactly the quarter's dates (e.g. `CURR3`). Otherwise (B) the difference of two cumulative periods from the same fiscal-year start whose end dates are the quarter's end and the day before its start, with compatible bases. Fiscal Q1 has no strategy B. A target that is not three whole months, is not aligned to the fiscal year or leaves it is rejected. Missing inputs are `missing_period`.
9. **Trailing twelve months.** (a) A reported twelve-month period ending on the date; (b) year-to-date + prior fiscal year − prior year-to-date; (c) four contiguous standalone quarters (each by rule 8). All inputs must be mutually compatible. When no strategy succeeds, an incompatibility reason is reported in preference to `missing_period`.
10. **Selection across filings** (per fact identity, issuer and scope), considering only publications at or before the as-of time (no look-ahead):
    - `as_originally_reported`: the earliest publication that reported the period as its *current* period (it ends on that filing's reporting date). Later comparatives and corrections never change it. A period only ever seen as a comparative is `no_original_report`.
    - `latest_compatible`: the latest publication, current or comparative, in the requested purchasing-power basis. If no basis is requested, any known basis. `unknown` bases are never selected (`no_compatible_basis`).
    - Equal publication times with different values are `conflicting_values`, never a choice.
    - Selection runs before quarter/TTM planning; a series is built from selected values that then pass rule 6.
11. **Corrections.** A corrected or re-filed report (`disclosureReason` `UPD`/`CORR` with `relatedDisclosureIndex`) is a new filing with its own publication time; it takes part in `latest_compatible` and never replaces the original in `as_originally_reported`. No FR correction has been observed yet (02.01 gap). 03.03/04.05 revisit this rule against production evidence before relying on it.
12. **Publication (for 04.01/04.05).** A *filing build* (one source revision × one parser build) moves `building → validated → published → superseded`, or `→ failed`. It is validated only when every expected subreport parsed and no blocking quality check failed. Publication switches a current-build pointer per (issuer, filing) in one transaction; readers see the previous or the new build, never a mixture. A failed or unvalidated build never replaces a published one. Superseded builds and their facts are retained. Derived values (05.x) record the generation of every input build.
13. **Explicit unavailability.** Every rule above ends in a value or a reason from `FinancialUnavailableReasonSchema`. At the API, missing reasons map to `NumericValue` status `missing`; compatibility reasons map to `incompatible` (A06). Financial values travel with `FinancialValueContextSchema`: period, scope, basis, selection policy and publication time.

## Consequences

- 04.01 stores contexts by dates, facts with temporal role, sorted dimensions and unit, occurrences as lineage, and per-filing scope, fiscal coverage, publication time and basis evidence. 04.05 implements the build states and pointer switch.
- 04.06 checks closing/opening balance agreement, repeated-presentation conflicts and label/date disagreements, and reports them without repair.
- 05.02 implements quarter and TTM arithmetic from these plans with `@finpill/contracts` decimals and records lineage per input.
- Until basis evidence exists for fiscal years ending on or after 2023-12-31, derivations across those filings return `purchasing_power_basis_unknown`. Values reported directly in one filing remain usable.
- Production evidence can still change rules 4, 7 and 11: TMS 29 filings, FR corrections and real 12-quarter histories are 02.01 gaps. Changing them is an update to this ADR.
