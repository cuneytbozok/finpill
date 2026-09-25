# BIST Fundamental Intelligence Platform
## Project Blueprint / Technical Product Specification

**Version:** 0.5 (2026-09-24)
**Status:** Current approved product and architecture baseline. v0.5 applies the approved blueprint corrections BC-01–BC-15, BC-17, BC-19 and BC-20, plus the environment/release part of BC-16; BC-18 was applied in v0.4. See the [correction register](BLUEPRINT_CORRECTIONS.md). The applied corrections document approved direction and invariants. They do not claim implementation, and they do not accept any architecture decision record (ADR). Concrete schemas, algorithms and methodologies stay with the roadmap tasks and ADRs that own them.
**Document roles:** this blueprint owns architecture and invariants; [MVP_EXECUTION_PLAN.md](MVP_EXECUTION_PLAN.md) owns task scope, order and acceptance; [AGENTS.md](../AGENTS.md) owns the development workflow.
**Primary market:** Borsa İstanbul (BIST)  
**Primary data source:** KAP / MKK API  
**Product direction:** Fundamental-first equity intelligence platform with AI-assisted interpretation. Technical analysis is a later phase.

---

## 1. Product Goal

Build a mobile-first web application that continuously collects official company disclosures and financial statements, converts them into a normalized historical dataset, calculates deterministic financial metrics, and uses AI to explain what changed and why it may matter.

The system should allow a user to open a company and quickly answer:

- What changed in the latest financial report?
- Is growth improving or deteriorating?
- Are margins improving?
- Is the balance sheet strengthening or weakening?
- Is cash generation consistent with reported earnings?
- How has valuation changed through time?
- Which KAP disclosures may explain major financial changes?
- What did management announce previously, and what happened afterwards?
- How does the latest period compare with prior quarters and prior years?

The platform must prioritize **traceability**. Every financial value and every derived metric should be explainable back to its original KAP source and calculation formula.

---

## 2. Core Product Principles

### 2.1 Deterministic finance, AI-assisted interpretation

AI must not be responsible for core arithmetic.

Financial calculations such as revenue growth, gross margin, EBITDA, net debt, ROE, P/E, P/B, EV/EBITDA, YoY/QoQ changes and TTM values must be calculated by deterministic application code.

AI is used for disclosure classification, event extraction, summarization, identifying possible business drivers, linking disclosures to later financial results, natural-language explanations and company Q&A over official documents.

### 2.2 Raw data is immutable

Original KAP responses must be retained.

The system separates:

1. raw source data
2. normalized financial facts
3. calculated metrics
4. AI-derived interpretations

A later filing may restate a prior reporting period. Historical facts must therefore be versioned rather than overwritten.

### 2.3 Every metric needs lineage

The UI should eventually allow:

```text
Revenue: TRY 661.3m
Source: KAP disclosure 1230809
Taxonomy concept: Revenue
Context: 2023-06-01 → 2023-11-30
Formula: direct reported fact
```

For calculated metrics:

```text
EBITDA
Formula version: ebitda_v1
Components: Operating Profit + Depreciation & Amortisation
```

### 2.4 Periods must come from source context

Do not assume all companies use calendar-year reporting.

KAP financial responses contain actual period contexts such as instant dates for balance-sheet facts and start/end dates for flow facts. The application must use actual source dates rather than infer dates from labels such as "6 Aylık".

---

# 3. MVP Scope

## Included

- BIST listed company directory
- company/security mapping
- KAP disclosure ingestion
- financial report ingestion
- structured financial statement parser
- historical financial facts
- standardized core metrics
- quarterly / cumulative / TTM handling
- historical trend charts
- end-of-day (EOD) valuation metrics (market capitalization, EV, P/E, P/B, EV/EBITDA where applicable) using historical prices, share counts and point-in-time financials
- KAP disclosure timeline
- AI disclosure classification
- AI company-change summary
- basic natural-language company Q&A
- watchlist
- scheduled synchronization
- calculation lineage
- source links
- global company search
- responsive web + mobile navigation
- source/lineage drill-down
- data freshness indicators
- loading, empty, stale and error states
- light/dark theme support

## Explicitly excluded from MVP

- brokerage integration
- order execution
- portfolio trading automation
- real-time market data
- intraday technical analysis
- automated buy/sell recommendations
- social/community features
- advanced backtesting
- separate Python microservice unless required
- separate vector database service

Later phases, not MVP: returns metrics (ROE/ROA/ROIC, §14), product scoring (§36), push notifications (§22.12) and technical analysis. The MVP architecture must not preclude them.

---

# 4. Recommended Technology Stack

## Application

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

## Mobile

- Capacitor

One statically exported Next.js client is shared by the browser, iOS and Android. Capacitor bundles its compiled assets. There is no remote `server.url`, no embedded Next.js server and no server secret in native assets. Server features run in a **separately deployed Next.js API**, which clients call through a versioned `/api/v1` contract. Native authentication uses narrow adapters over the official Clerk iOS/Android SDKs behind a shared `AuthPort`.

## Hosting

- Vercel: two projects from one repository. The static client project and the separate API project deploy and version independently.

## Database

- Supabase PostgreSQL

## Authentication

- Clerk

Clerk handles application authentication and user-facing auth UX. Supabase remains the primary database and storage layer.

## Storage

- Supabase Storage

## Vector search

- pgvector in Supabase

No Pinecone/Qdrant in MVP.

## Scheduled jobs

- Supabase Cron initially

Move heavy ingestion workloads to a dedicated worker later if required.

## AI

- Vercel AI SDK
- Vercel AI Gateway

Generation models should be configurable through environment variables. The embedding model should be treated as a versioned infrastructure choice because changing it requires re-embedding historical chunks.

## Charts

- TradingView Lightweight Charts for financial/price time-series
- ECharts where richer analytical charts are needed

## Source control / development

- GitHub
- Cursor
- Codex

---

# 5. High-Level Architecture

```text
                    ┌─────────────────────┐
                    │      KAP / MKK      │
                    │       REST API      │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Ingestion Layer   │
                    │ raw API responses   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Financial Parser    │
                    │ ReportItem traversal│
                    │ Context normalize   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Normalized Facts    │
                    │ PostgreSQL          │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┴─────────────┐
                 ▼                           ▼
       ┌────────────────────┐      ┌─────────────────────┐
       │ Deterministic      │      │ Disclosure / Text   │
       │ Metric Engine      │      │ Processing          │
       └─────────┬──────────┘      └──────────┬──────────┘
                 │                            │
                 ▼                            ▼
       ┌────────────────────┐      ┌─────────────────────┐
       │ Metric History     │      │ AI Event Extraction │
       │ Valuation / Trends │      │ Embeddings / RAG    │
       └─────────┬──────────┘      └──────────┬──────────┘
                 └─────────────┬──────────────┘
                               ▼
                    ┌─────────────────────┐
                    │ Next.js API / App   │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │ Web + Capacitor App │
                    └─────────────────────┘
```

The "Next.js API / App" box is the **separate API deployment**. The client is a static export shared by web and Capacitor and holds no secrets or privileged database access. Ingestion and processing run as bounded, authenticated API job handlers dispatched by Supabase Cron. PostgreSQL owns job claims, leases, checkpoints and deduplication (§12.19, §28).

---

# 6. KAP API Integration

## 6.1 Validated development environment

Development API base:

```text
https://apigwdev.mkk.com.tr/api/vyk
```

Development authentication has been successfully tested with HTTP Basic Auth.

Credentials must only be stored in server-side environment variables. Never expose KAP credentials to the browser or Capacitor client.

## 6.2 Important endpoints

### Company directory

```http
GET /members
```

Used to obtain company id, company title, stock code, member type and KAP company URL.

Example mapping already validated:

```text
KUYAS
companyId = 1619
```

### Latest disclosure index

```http
GET /lastDisclosureIndex
```

Used as the cursor anchor for synchronization.

### Disclosure list

```http
GET /disclosures?disclosureIndex={index}
```

The API returns the first 50 disclosures beginning from a supplied disclosure index.

Optional filters include `disclosureTypes`, `disclosureClass`, and `companyId`.

Do not rely on filters for historical crawling until their exact production behavior has been validated. Cursor-based ingestion should remain the primary mechanism.

### Disclosure detail

```http
GET /disclosureDetail/{disclosureIndex}?fileType=data
```

Optional:

```text
subReportList={subReportId}
```

If `subReportList` is omitted, the service can return all subreports.

### Attachment download

```http
GET /downloadAttachment/{id}
```

Use only when a document attachment is required. Structured `presentation` data should be preferred whenever available.

---

# 7. Production KAP Authentication

Production authentication remains **TBD until validated against the live MKK documentation and account**.

Documentation observed so far indicates a production token flow similar to:

```http
GET /auth/generateToken?apiKey=...
```

Development documentation explicitly differs from production behavior.

Implementation rule:

```text
KAP_AUTH_MODE=basic | token
KAP_BASE_URL=...
KAP_API_KEY=...
KAP_API_SECRET=...
```

Create an authentication adapter so environment differences do not leak into application logic.

```ts
interface KapAuthProvider {
  getHeaders(): Promise<Record<string, string>>
}
```

Implementations:

```text
KapBasicAuthProvider
KapTokenAuthProvider
```

---

# 8. Financial Report Structure

A validated KAP financial report returned:

```text
disclosureType  = FR
disclosureClass = FR
```

with four structured subreports:

```text
general_role_210015
general_role_310003
general_role_520003
general_role_610000
```

Observed meaning:

```text
general_role_210015
→ Statement of Financial Position / Balance Sheet

general_role_310003
→ Profit or Loss and Other Comprehensive Income

general_role_520003
→ Cash Flow Statement

general_role_610000
→ Statement of Changes in Equity
```

Do not hard-code the numeric role IDs as the only source of truth. The parser should identify statement type using both subreport ID and root ReportItem taxonomy name.

---

# 9. KAP Financial Parser

## 9.1 Important source shape

```text
presentation[]
 └── content
      ├── ContextList
      │    └── Context
      └── ReportItem
           ├── ReportItem
           │    └── ReportItem ...
           └── Values
                └── Value
```

## 9.2 Source shape is inconsistent

These fields may be either an object or an array depending on cardinality:

```text
Context
ReportItem
Value
lang
```

Normalize all of them before processing.

```ts
export function arrayify<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}
```

## 9.3 Recursive fact extraction

```ts
type KapReportItem = {
  name?: string
  abstract?: string
  preferredLabel?: string
  langs?: unknown
  Values?: unknown
  ReportItem?: KapReportItem | KapReportItem[]
}
```

Traverse recursively. For every value-bearing item create normalized facts.

```json
{
  "concept": "Revenue",
  "label_tr": "Hasılat",
  "label_en": "Revenue",
  "context_id": "2023-06-012023-11-30",
  "currency": "TRY",
  "rounding": "INF",
  "value": "661324931"
}
```

## 9.4 Preserve presentation metadata

Do not discard:

- `preferredLabel`
- source taxonomy concept
- hierarchy/path
- statement type

Some expense concepts are represented as positive raw amounts while `preferredLabel` indicates negative presentation semantics.

Example:

```text
CostOfSales
preferredLabel = negatedLabel
```

The normalization layer must preserve raw facts exactly. Sign normalization, where required for calculations, belongs in a separate taxonomy mapping/calculation layer.

---

# 10. Period and Context Model

Two fundamentally different context types exist.

## Instant context

Used primarily for balance-sheet data.

```text
2023-11-30
```

## Duration context

Used for income-statement and cash-flow data.

```text
2023-06-01 → 2023-11-30
```

The validated financial response also included:

```text
CURR
CURR3
PREV
PREV3
```

Typical interpretation:

```text
CURR  = current cumulative reporting period
CURR3 = current standalone three-month period
PREV  = comparable prior-year cumulative period
PREV3 = comparable prior-year three-month period
```

Do not infer this only from the key. Use `Period.startDate`, `Period.endDate` and `Period.instant` as authoritative dates.

---

# 11. Standalone Quarter Calculation

Preferred order:

### Strategy A — direct standalone period

If a dedicated current 3-month context exists, use it.

### Strategy B — derive standalone quarter

If standalone context is unavailable:

```text
Q1 = Q1 cumulative
Q2 standalone = H1 cumulative - Q1 cumulative
Q3 standalone = 9M cumulative - H1 cumulative
Q4 standalone = FY cumulative - 9M cumulative
```

All calculated standalone periods must store calculation lineage.

Derive a standalone quarter only from **compatible** inputs. Compatible means the same issuer and reporting scope (consolidated/standalone), fiscal year, accounting and TMS 29 basis, and a selected filing/restatement version valid as of the calculation date. Incompatible or missing inputs produce an explicit "unavailable" result with a reason; they are never guessed. The concrete compatibility and selection rules are in [A07](adr/A07-financial-identity-and-compatibility.md) (task 02.05); metric-specific applicability belongs to A09 and the arithmetic to 05.02.

---

# 12. Database Design

## 12.0 Status of this schema sketch (v0.5)

The table lists in §12.1–12.19 are the original illustrative sketch, **not an approved schema**. Concrete tables, keys and columns are defined by the owning roadmap tasks' migrations and ADRs. The approved invariants below override any conflicting detail in the sketch:

- **Identity and authorization (BC-03, A02):**
  - User identity is the Clerk subject, stored as text.
  - User-owned rows are protected by Supabase RLS using the verified Clerk token through Supabase third-party authentication.
  - Private-pilot eligibility is an operator-managed allowlist.
  - User, operator/admin and machine (job) authorities are separate. User requests never use service-role authority.
- **Issuer vs security identity (BC-04, A04):**
  - Issuers (KAP members) and tradable securities are distinct entities with stable internal IDs.
  - Tickers, ISINs and KAP identifiers are effective-dated mappings, not primary keys.
  - Prices and share counts attach to securities.
  - Concrete tables, constraint semantics and resolution rules: [A04](adr/A04-issuer-security-identity.md) (task 02.02). An exchange code can name several share classes of one issuer, so ticker → issuer resolves but ticker → security can be ambiguous and is never guessed.
- **Immutable sources (BC-05, A05):**
  - A logical disclosure is separate from its source revisions and acquisition observations.
  - Each exact payload representation/subreport is stored immutably with hashes.
  - Nothing overwrites a prior revision.
  - Concrete tables, storage keys, revision and concurrency rules: [A05](adr/A05-immutable-source-revisions.md) (task 02.03). Exact bodies live in a private, content-addressed Storage bucket; representations and subreport scopes are separate documents.
- **Financial identity and publication (BC-06, A05/A07):**
  - Facts carry explicit context, reporting scope, source revision and parser-build identity.
  - Comparative restatements are selectable by policy and as-of date.
  - Replacements are published atomically through current-version pointers.
  - Partially processed builds are never published.
  - Concrete fact identity (dates from `Period`, temporal role from `preferredLabel`, dimensions from value measures), fiscal coverage, knowledge time, compatibility order, TMS 29 basis rules, quarter/TTM strategies, selection policies and build states: [A07](adr/A07-financial-identity-and-compatibility.md) (task 02.05).
- **Exact numbers (BC-08, A06):**
  - Source numbers are parsed losslessly and stored as PostgreSQL `numeric`.
  - Calculations use a decimal library.
  - Authoritative amounts cross transport boundaries as decimal strings.
  - Rounding happens only in presentation. Chart-only approximations are labeled as such.
  - Concrete limits, rounding modes, the `exact_decimal` storage domain, lossless JSON parsing and the formatting policy: [A06](adr/A06-exact-numbers.md) (task 02.04).
- **Recoverable execution (BC-09, A08):**
  - Jobs support atomic claiming, leases with fencing, retries with recorded failures, transactional checkpoints, source-wide rate budgets and version-aware idempotency keys.
  - Execution is at-least-once, so handlers must be idempotent.
- **Market data (BC-11, A10):**
  - Historical share counts and corporate actions carry provenance.
  - Valuations join financials and prices as of their publication/availability time, never with look-ahead.
- **AI records (BC-12, A11/A12):**
  - AI generations are persisted with model, prompt and schema versions and their evidence.
  - Conversations are user-owned.
  - Embeddings record model, dimensions and text/chunk versions, with an explicit re-embedding cutover.

## 12.1 companies

```text
id
kap_company_id
stock_code
title
member_type
kap_url
is_active
created_at
updated_at
```

Unique: `kap_company_id`, `stock_code`. (v0.5: `stock_code` is an effective-dated security mapping, not a stable issuer key; see §12.0.)

## 12.2 securities

```text
id
company_id
isin
exchange_code
clearing_code
capital
current_capital
group_code
is_trading_open
raw_payload
updated_at
```

## 12.3 kap_sync_state

```text
id
source
last_seen_disclosure_index
last_success_at
last_error
updated_at
```

## 12.4 kap_disclosures

```text
id
disclosure_index
company_id
disclosure_type
disclosure_class
reason
consolidation
year
period_label_tr
period_label_en
subject_tr
subject_en
summary_tr
summary_en
published_at
source_link
subreport_ids
accepted_data_file_types
content_hash
raw_payload
detail_fetched_at
ingested_at
```

Unique: `disclosure_index`. (v0.5: a single mutable `raw_payload` per disclosure is superseded by immutable source revisions and acquisition observations; see §12.0.)

## 12.5 kap_disclosure_attachments

```text
id
disclosure_id
file_name
source_url
storage_path
mime_type
download_status
created_at
```

## 12.6 financial_filings

```text
id
company_id
disclosure_id
reporting_year
period_label
consolidation
published_at
filing_version
is_latest_version
created_at
```

Never delete prior filing versions when a report is restated.

## 12.7 financial_contexts

```text
id
filing_id
context_id
context_key
context_type
instant_date
start_date
end_date
raw_payload
```

`context_type`: `instant | duration`.

## 12.8 financial_facts

```text
id
company_id
filing_id
statement_type
subreport_id
concept
label_tr
label_en
preferred_label
context_id
currency
rounding
raw_value
numeric_value
hierarchy_path
source_disclosure_index
created_at
```

Monetary database type: the `exact_decimal` domain (unconstrained `numeric`, 30 integer and 18 fraction digits), not `numeric(38, 6)`; see [A06](adr/A06-exact-numbers.md).

Indexes:

```text
(company_id, concept)
(company_id, context_id)
(filing_id, concept)
(source_disclosure_index)
```

## 12.9 taxonomy_mappings

```text
id
concept
standard_metric
statement_type
sign_rule
priority
valid_from
valid_to
mapping_version
notes
```

Example:

```text
Revenue → revenue
GrossProfit → gross_profit
CashAndCashEquivalents → cash_and_cash_equivalents
Equity → equity
```

## 12.10 metric_values

```text
id
company_id
period_start
period_end
period_type
metric
value
currency
calculation_version
source_filing_ids
created_at
```

`period_type`: `instant | quarter | cumulative | ttm | annual`.

## 12.11 metric_lineage

```text
id
metric_value_id
formula_name
formula_version
source_fact_ids
source_metric_ids
calculation_payload
created_at
```

## 12.12 metric_observations

```text
id
company_id
metric
period_end
value
previous_value
yoy_change
qoq_change
ttm_value
percentile_5y
sector_percentile
calculation_version
```

May later become a materialized view.

## 12.13 market_prices

Market data does not come from KAP and requires a separate provider.

```text
id
company_id
trading_date
open
high
low
close
adjusted_close
volume
source
```

(v0.5: prices attach to a security, not a company, and keep source observation and availability timestamps; see §12.0.)

MVP may begin with end-of-day data. Real-time BIST redistribution must not be implemented until licensing/data-provider requirements are resolved.

## 12.14 valuation_metrics

```text
id
company_id
as_of_date
market_cap
enterprise_value
pe
pb
ev_ebitda
price_to_sales
calculation_version
```

## 12.15 kap_events

```text
id
disclosure_id
company_id
event_type
event_subtype
summary
amount
currency
recurring
cash_impact
debt_impact
revenue_impact
profit_impact
materiality
confidence
model
prompt_version
structured_payload
created_at
```

## 12.16 document_chunks

```text
id
company_id
disclosure_id
attachment_id
chunk_index
text
metadata
embedding
embedding_model
created_at
```

Use pgvector. Do not embed numeric financial facts for numeric querying.

## 12.17 analysis_snapshots

```text
id
company_id
as_of_date
financial_period_end
growth_payload
profitability_payload
balance_sheet_payload
cashflow_payload
valuation_payload
earnings_quality_payload
summary
model
prompt_version
analysis_version
trigger_type
source_fingerprint
created_at
```

The goal is to preserve what the system believed at each point in time rather than continuously overwriting analysis.

## 12.18 users / watchlists

Authentication identity is owned by Clerk.

Application tables:

```text
user_profiles
watchlists
watchlist_companies
user_preferences
```

Use the Clerk user ID (text subject) as the external identity and as the owner key for RLS. A `pilot_eligibility` allowlist gates private-pilot access. See §12.0 and §32.

---

## 12.19 processing_jobs

Lightweight database-backed work queue for event-driven processing before a dedicated worker/queue service is necessary.

```text
id
job_type
entity_type
entity_id
idempotency_key
status
attempt_count
run_after
payload
last_error_code
last_error_message
created_at
started_at
completed_at
updated_at
```

Recommended `job_type` values:

```text
kap_disclosure_detail
financial_report_parse
metric_recalculation
disclosure_event_extraction
analysis_snapshot
market_valuation_refresh
document_embedding
```

`idempotency_key` must be unique. Example:

```text
financial_report_parse:1230809:parser_v1
analysis_snapshot:1619:2026-06-30:analysis_v1
```

This prevents duplicate cron runs or retries from repeating expensive work or AI calls. Claims, leases, fencing and checkpoint rules (§12.0) make at-least-once execution safe.

---

# 13. Metric Engine

The metric engine is a pure deterministic TypeScript module.

Suggested directory:

```text
src/domain/metrics/
```

Each metric definition should expose:

```ts
type MetricDefinition = {
  id: string
  version: string
  calculate: (...args: unknown[]) => unknown
  requiredInputs: string[]
}
```

Example:

```text
metric: gross_margin
formula: gross_profit / revenue
```

---

# 14. Initial Standard Metrics

## Income statement

- revenue
- cost of sales
- gross profit
- operating profit
- EBITDA
- net financial income/expense
- pre-tax profit
- net profit
- parent net profit where applicable

## Balance sheet

- cash and cash equivalents
- current assets
- non-current assets
- total assets
- short-term financial debt
- current portion of long-term debt
- long-term financial debt
- total liabilities
- equity

## Cash flow

- operating cash flow
- investing cash flow
- financing cash flow
- capex
- depreciation and amortisation
- free cash flow

## Growth

- revenue YoY / QoQ
- EBITDA YoY / QoQ
- net profit YoY / QoQ

## Margins

- gross margin
- EBITDA margin
- operating margin
- net margin

## Balance-sheet quality

- net debt
- net debt / EBITDA
- current ratio
- debt / equity
- cash / total assets

## Returns — later phase

- ROE
- ROA
- ROIC

---

# 15. EBITDA Methodology

Do not hide methodology.

KAP may not provide a single standardized EBITDA field for every issuer.

Validated structured data includes concepts such as:

```text
ProfitLossFromOperatingActivities
AdjustmentsForDepreciationAndAmortisationExpense
```

Candidate formula:

```text
EBITDA = Operating Profit + Depreciation + Amortisation
```

The final production definition must be formally documented and tested against several issuers and an external reference dataset before being considered stable.

Store methodology versions:

```text
ebitda_v1
ebitda_v2
...
```

Never silently modify historical calculations.

---

# 16. Net Debt Methodology

Candidate base:

```text
financial borrowings
+ current portion of long-term borrowings
+ long-term borrowings
- cash and cash equivalents
```

Potential additions depending on chosen methodology:

- lease liabilities
- short-term financial investments
- other interest-bearing debt

Finalize after cross-company validation.

---

# 17. Valuation Metrics

Requires price/share-count data. Valuation is part of the MVP and is based on EOD prices. Each valuation uses the security's historical share count and corporate-action-adjusted inputs, and only the financials published by that date. Any price or share-count gap yields an explicit "unavailable" result. The formulas and provider semantics are finalized under A10 (roadmap phase 06).

## Market capitalization

```text
share price × shares outstanding
```

## P/E

```text
market cap / net profit TTM
```

If denominator <= 0, display `N/M` rather than a misleading negative P/E by default.

## P/B

```text
market cap / equity
```

## Enterprise value

Initial:

```text
market cap + net debt
```

Later methodology may incorporate minority interest, preferred equity and other adjustments.

## EV/EBITDA

```text
enterprise value / EBITDA TTM
```

All valuation methodology must be versioned.

---

# 18. Restatements / TMS 29

Financial statements may be restated. Comparisons across different accounting, TMS 29 or restatement bases are rejected unless an approved compatibility rule exists. The system never silently adjusts or mixes bases (see §11 and [A07](adr/A07-financial-identity-and-compatibility.md): a TMS 29 value carries its measuring-unit date and combines only with values in the same measuring unit; a basis without evidence is `unknown` and combines with nothing).

The system must distinguish:

```text
originally reported value
latest restated comparative value
```

Required behavior:

- never overwrite raw filing facts
- associate every fact with its filing
- mark the latest filing version
- allow recalculation from latest-restated history
- retain original history for auditability

Future UI option:

```text
Reported at the time
Latest restated
```

---

# 19. Disclosure Event Processing

Numeric values in examples throughout this document are illustrative. Authoritative amounts are stored as `numeric` and transported as decimal strings (§12.0).

Non-financial KAP disclosures should be ingested and then classified by AI.

Possible event taxonomy:

```text
contract
order
investment
capex
capacity
acquisition
disposal
financing
debt
capital_increase
capital_decrease
dividend
share_buyback
management_change
legal
regulatory
credit_rating
guidance
production
sales
partnership
other
```

Example structured extraction:

```json
{
  "event_type": "contract",
  "amount": 750000000,
  "currency": "TRY",
  "recurring": false,
  "revenue_impact": "positive_possible",
  "cash_impact": "unknown",
  "materiality": "high",
  "confidence": 0.93
}
```

AI output is an interpretation layer, not source truth. Every extracted event links back to the original disclosure.

---

# 20. Company Memory / Timeline

One major product feature is a chronological company intelligence timeline.

```text
2026-02  New factory investment announced
2026-04  Capex financing disclosed
2026-Q2  Net debt increased
2026-Q3  Capacity became operational
2026-Q4  Revenue growth accelerated
```

The system should allow AI to answer:

> Did the announced investment later appear in the financial statements?

This requires linking events → later financial metrics → analysis snapshots.

Do not treat correlation as causation unless supported by company disclosure.

---

# 21. AI Architecture

Every AI output is a persisted, versioned generation record: model, prompt and schema version, evidence references and status. Numeric claims must be grounded in deterministic data. Retrieval quality is evaluated before AI outputs are shown, and changing the embedding model requires a versioned re-embedding cutover (§12.0, §47, A11/A12).

## 21.1 Generation

Use Vercel AI SDK + AI Gateway.

```text
AI_MODEL_ANALYSIS
AI_MODEL_EXTRACTION
AI_MODEL_CHAT
```

No model name should be hard-coded deep in business logic.

## 21.2 Structured output

All extraction tasks use schema validation:

- Zod
- strict JSON schema
- retry on invalid structure

## 21.3 RAG

Retrieval combines:

```text
structured filters
+ keyword search
+ vector similarity
```

Filter first by company, date range, disclosure type and event type, then semantic search.

## 21.4 Numeric questions

For questions such as:

> Son 8 çeyrekte brüt marj nasıl değişti?

Do not ask the language model to retrieve the numbers from embeddings. Query PostgreSQL structured metrics and provide the result to the model for explanation.

---

# 22. UX/UI, Information Architecture & Navigation

This section is the product contract for the user-facing application. Cursor/Codex should not invent a new navigation model per screen. New UI work must fit this information architecture unless the blueprint is intentionally updated.

## 22.1 UX principles

The product should feel like a **financial research application**, not a crypto exchange, brokerage order-entry screen or generic AI chatbot.

Primary principles:

- information-dense without looking crowded
- financial data first, decoration second
- important changes should be visible within seconds
- tables and charts should be readable on desktop and mobile
- AI explanations must remain secondary to underlying facts
- every important number should be traceable to source/calculation
- positive/negative colors should communicate meaning, not decorate the UI
- avoid unnecessary animation
- do not hide critical information behind hover-only interactions
- use consistent terminology throughout the app
- preserve the user's current company, period and tab when navigating back where practical

## 22.2 Device strategy

The product is built mobile-first but must take advantage of larger screens.

```text
Mobile
→ bottom navigation
→ vertically stacked company modules
→ horizontal scroll for dense tables only where unavoidable
→ bottom sheets / full-screen drawers for detail

Tablet
→ bottom navigation or compact sidebar depending on width
→ two-column layouts where useful

Desktop
→ persistent left sidebar
→ wider company header
→ multi-column metric cards
→ denser financial tables
→ source/detail drawer on the right
```

Responsive breakpoints should use the Tailwind defaults initially unless a real UX requirement justifies custom breakpoints.

## 22.3 Primary navigation

### Mobile bottom navigation and desktop sidebar

Use exactly three primary destinations on both platforms:

```text
Ana Sayfa  → /
İzleme     → /watchlist
Daha Fazla → /settings
```

- Search is a persistent global control, not a primary navigation item.
- AI analysis and Q&A are reached in company context, not through a global AI destination.
- Navigation labels must remain visible; selected state must identify the actual primary destination.
- Company pages and focused search are detail destinations: do not label them as the home screen or mark Home as their current page. Provide a clear back/return action; a direct entry without history returns to Home.
- Company-specific tabs do not belong in global navigation.
- Tapping an already selected primary item may return to its root.
- Discover and Screener remain deferred; this revision does not add them to MVP.

## 22.4 Route map

Recommended user-facing routes:

```text
/
/search
/watchlist
/settings

/company/[ticker]
/company/[ticker]/financials
/company/[ticker]/ratios
/company/[ticker]/disclosures
/company/[ticker]/ai
```

`/search` remains addressable even though it has no primary-navigation tab. `/company/[ticker]/ai` is the company analysis/Q&A detail destination, reached through explicit actions rather than a fifth company tab.

The existing `/ai` route is a compatibility entry only: replace it with `/search` without inferring a company, generating analysis, or adding a new global AI selector. Preserve normal browser/native back behavior without a redirect loop. Company AI deep links remain supported.

Optional nested URLs for sharable state:

```text
/company/[ticker]/financials?statement=income&period=quarterly
/company/[ticker]/disclosures?type=new_business
```

Do not encode ephemeral UI state in the URL unless it is useful for refresh, navigation or sharing.

These canonical URLs are resolved by a client-side route registry inside the static client, so tickers are not enumerated at build time. The web host falls back to the entry asset. Native shells map incoming canonical URLs to the same routes through a shared navigation adapter that validates origin and route and rejects untrusted hosts. Opening the app from an OS-verified HTTPS Universal/App Link needs an owned link domain and paid Apple signing. It is **post-MVP** (BC-19). Canonical web routes, in-app navigation, sign-in return and browser/Android Back remain MVP requirements.

## 22.5 Global app shell

The authenticated shell should provide:

```text
Navigation
Persistent global company search control
Theme control
Freshness / system status entry where relevant
User/settings entry
```

Desktop provides a visible search input and keyboard shortcut:

```text
⌘K / Ctrl+K → global company search
```

## 22.6 Home

The home page should answer:

> What changed in the companies I care about?

MVP modules, in order of importance:

```text
Watchlist changes
Recent important KAP events
New financial reports
Recently updated company analyses
```

Optional market summary should remain lightweight until a reliable market-data source is integrated.

Do not turn the home page into a generic news portal.

Example card:

```text
KUYAS                     New event • 42m ago
Revenue YoY        -61%
Gross Margin       +8.7 pp
Latest KAP         Financial Report
```

## 22.7 Search

Search is primarily company/ticker discovery in MVP. Desktop uses the persistent input with a results dropdown and keyboard access; mobile opens a focused `/search` view from the persistent search control. The addressable search view must also work on desktop and direct entry. Support results, recent searches, loading, empty and error states. Dismissing a dropdown restores focus; leaving the focused view restores the prior screen, with Home as the direct-entry fallback. Selecting a result opens its company overview.

Task 01.08 owns the shell entry and focus behavior; task 07.01 supplies real directory results. No directory or AI backend is required to prove the foundation shell.

Search input should match:

```text
Ticker
Company legal title
Common normalized company name
```

Example:

```text
"kuy" → KUYAS — Kuyaş Yatırım A.Ş.
```

Recent searches may be stored locally or per user.

Later search expansion may include:

```text
KAP disclosures
sectors
financial concepts
```

but company search remains the primary behavior.

## 22.8 Watchlist

A watchlist row/card should convey more than the ticker.

Suggested fields:

```text
Ticker / company
Latest price (when market data exists)
Daily change (when available)
Latest reporting period
Revenue YoY
Net Profit YoY
Latest important event
Unread/new indicator
```

The watchlist should make it immediately visible which companies have **new information since the user's last view**.

MVP supports one default watchlist. Multiple named watchlists can be added later.

## 22.9 Company page information architecture

The company page is the core product surface.

Company-local navigation:

```text
Overview
Financials
Ratios
KAP & Events
```

These four visible tabs are Genel Bakış, Finansallar, Oranlar and KAP & Olaylar. Analysis and Q&A use contextual actions below. On mobile this can be a horizontally scrollable sticky tab bar. On desktop it can be a tab row below the company header.

### Company header

Persistent across company tabs:

```text
Ticker
Company name
Watchlist toggle
Latest price / daily change     [when market data exists]
Market cap                      [when market data exists]
Latest financial period
Last data update
```

Do not block the whole company page when market-price data is unavailable. Fundamental sections should continue to work.

### Overview

Recommended order:

```text
1. What Changed? / Ne Değişti?
2. Key financial metrics
3. Financial trend charts
4. Valuation snapshot
5. Latest important KAP events
```

“Detaylı analiz” opens the saved company analysis. “Bu şirket hakkında sor” opens company Q&A with the company already selected. Each AI takeaway must expose the supporting financial values or KAP disclosures through validated references. Distinguish facts from interpretation.

Before AI is available, show an honest unavailable/empty module state and keep financial modules usable; never substitute sample analysis as live output.

Key metrics:

```text
Revenue
Gross Profit
EBITDA
Net Profit
Equity
Net Debt
```

Each metric shows when available:

```text
Current value
YoY change
QoQ change
small historical sparkline
```

Show the actual reporting period and comparison basis beside each value/change. Distinguish standalone quarter, cumulative, annual and TTM; avoid ambiguous labels such as “2024/3”. Turkish labels such as “2024 · 3. çeyrek” or “2024 · İlk 9 ay” are examples only and must reflect actual source dates, including non-calendar fiscal periods. Margin deltas use percentage points, not percent growth. Unsupported comparisons show an explanation instead of a computed change.

### Financials

Top controls:

```text
Income Statement | Balance Sheet | Cash Flow
Quarterly | Annual
Standalone | Cumulative     [only where applicable]
```

Financial tables should keep the taxonomy-derived/source line items available, but the default view may prioritize common standardized rows.

Expected features:

- period columns
- sticky first column on narrow screens where practical
- number formatting by scale
- negative values visually distinct but not excessively bright
- source drill-down from a row/value
- restatement indicator where relevant

### Ratios

Group rather than presenting one huge list:

```text
Growth
Margins
Profitability
Balance Sheet
Liquidity
Cash Flow
Valuation
```

Examples:

```text
Revenue Growth
Gross Margin
EBITDA Margin
Net Margin
Current Ratio
Debt / Equity
Net Debt / EBITDA
ROE
P/E
P/B
EV/EBITDA
```

If a ratio cannot be meaningfully calculated, show `N/M` with an explanation rather than a misleading number.

### KAP & Events

Use chronological timeline/list presentation.

Filters:

```text
All
Financial Reports
New Business
Investment
Dividend
Capital
Buyback
Management
Legal / Regulatory
Other
```

Each event card may show:

```text
Date/time
Event type
Short AI summary
Materiality indicator (if enabled)
Original KAP link
Source label
```

The original disclosure remains the source of truth.

### AI

Analysis and Q&A are always company-scoped. The `/company/[ticker]/ai` detail view contains the saved analysis, reporting period and generation time, suggested questions, the user's previous company conversations, and supporting sources. Preserve company context and provide return navigation to the overview. Viewing saved content does not trigger generation or source acquisition.

“Bu şirket hakkında sor” opens the question interface; only explicit submission of a question generates an answer over existing structured metrics and retrieved official evidence. Private conversations remain owner-scoped and recoverable after refresh/reconnect. This remains an MVP capability; removal of a global AI tab does not remove chat/Q&A.

Suggested prompts:

```text
What changed in the latest financial report?
Why did net profit decline?
How has gross margin changed over the last 8 quarters?
What were the most important KAP disclosures in the last year?
Has net debt improved?
```

The company AI view must expose validated supporting metric references and source documents for published claims; unsupported claims must be withheld or explicitly identified as unavailable.

## 22.10 Source and lineage drill-down

Traceability is a first-class UI feature.

Clicking/tapping a financial value or calculated metric should open a drawer/sheet.

Example reported fact:

```text
Revenue
TRY 661.3m

Source type       Reported fact
KAP disclosure    1230809
Concept           Revenue
Period            2023-06-01 → 2023-11-30
Currency          TRY
Reported value    661,324,931
```

Example calculated metric:

```text
EBITDA
TRY ...

Source type       Calculated
Formula           Operating Profit + D&A
Formula version   ebitda_v1
Inputs            [clickable]
Filing            [clickable]
```

Mobile: bottom sheet/full-screen sheet.  
Desktop: right-side drawer.

## 22.11 Freshness UX

The UI must distinguish publication time from our processing time. Show independent freshness for source checks, financial processing, AI analysis generation/covered reporting period, and EOD prices. A successful KAP check does not establish that financials or analysis are current. Source-check time must not replace the source publication time. Each module supports current/updating/stale/unavailable independently; one subsystem outage must not hide other available modules.

Examples:

```text
KAP published:       18:22
Processed by app:    18:24
Price updated:       Previous close / 18:15
```

Recommended freshness states:

```text
Current
Updating
Stale
Unavailable
```

Never imply real-time data if the feed is delayed or end-of-day.

## 22.12 Notifications

Notifications are event-driven and optional.

MVP-capable notification types:

```text
New financial report for a watchlisted company
Important new KAP disclosure
Processing completed after a new filing
```

Later:

```text
Metric threshold crossed
Valuation threshold crossed
Technical signal
Price alert
```

Notification generation must use already-ingested events; opening a notification should deep-link to the relevant company/event.

## 22.13 Settings / More

MVP settings:

```text
Theme: System / Light / Dark
Language: Turkish initially
Number scale preference: Auto / Thousand / Million / Billion [optional]
Notification preferences
AI preferences [later]
Account / logout
Data-source information
```

Turkish is the default product language, but source English labels should be preserved in the database for future localization.

---

# 23. Design System & Screen Specifications

## 23.1 Visual direction

Target visual character:

```text
professional
calm
analytical
high information density
minimal decoration
```

Avoid:

```text
crypto/neon aesthetic
oversized gradients
excessive glassmorphism
constant red/green backgrounds
large empty marketing-style cards inside the app
```

The interface should feel closer to an institutional research dashboard simplified for a retail investor.

The owner-approved [research mockup](design/research-navigation-mockup.png) is a visual reference for hierarchy, spacing and restrained color, not a specification of financial values or runtime behavior. Its illustrative figures, “2024/3” labels, mixed-period chart and single freshness badge are not authoritative. The written period, evidence, freshness and navigation requirements in §§22–23 govern implementation.

## 23.2 Theme

Support:

```text
Light
Dark
System
```

Both themes must be designed intentionally. Dark mode is not simply inverted light mode.

Use semantic tokens instead of hard-coded component colors:

```text
background
surface
surface-muted
border
text-primary
text-secondary
positive
negative
warning
info
accent
```

Do not use positive/negative colors for decorative elements.

## 23.3 Typography

Use one primary UI sans-serif font available through the normal web/app stack.

Typography hierarchy:

```text
Page title
Section title
Card/metric title
Body
Caption / metadata
Tabular numeric style
```

Financial numbers should use tabular numerals when supported.

Avoid tiny text to create artificial information density.

Minimum body text should remain comfortably readable on mobile.

## 23.4 Spacing and layout

Use a consistent spacing scale derived from Tailwind tokens.

Guidelines:

- cards should not be nested repeatedly
- related metrics should share one visual group when possible
- section vertical spacing should be consistent
- desktop maximum content width should prevent charts/tables becoming excessively stretched
- tables may use more horizontal width than narrative content

## 23.5 Cards

Use cards for summaries, not for every individual piece of data.

Good use:

```text
6 key financial metrics in one financial-summary surface
What Changed? summary
Latest events
```

Avoid six unrelated heavy bordered cards if a compact metric grid communicates the same information more clearly.

## 23.6 Tables

Tables are a primary interface component.

Requirements:

- numeric values right-aligned
- labels left-aligned
- consistent period column formatting
- sticky headers where useful
- horizontal scrolling on mobile only when necessary
- explicit units
- restatement/source indicators should not clutter every cell
- clicking a value opens source/lineage details

## 23.7 Chart rules

Charts must answer a question, not merely decorate a section.

Never present annual, partial-year, standalone-quarter or TTM values as a like-for-like trend. Use a compatible selected basis, or explicitly separate and label different bases; reject unsupported financial comparisons. Preserve currency/unit and TMS 29 comparability requirements. Tooltips identify actual period dates and comparison basis; source-derived labels must not assume calendar quarters.

Default chart behavior:

```text
clear title
unit visible
period labels
minimal grid lines
accessible tooltip
no 3D effects
no unnecessary animation
```

Color rules:

- one metric: one neutral/accent series
- comparisons: limited distinct series
- negative financial values do not require the entire series to be red
- use red/green primarily for semantic changes and statuses

Common charts:

```text
Revenue bars
EBITDA bars
Net Profit bars
Margin lines
Net Debt line/bar
Equity line
Operating Cash Flow bars
Valuation multiple history
```

## 23.8 Financial number formatting

Centralize formatting functions. Components must not invent formatting rules.

Examples:

```text
1,049,330,437 TRY → ₺1.05B / ₺1,05 Mr depending product locale rule
0.1734 → 17.34%
3.284 → 3.28x
```

For Turkish UI, locale formatting should be consistent throughout the product.

The raw exact value remains available through source drill-down.

Recommended formatter utilities:

```text
formatCurrency
formatCompactCurrency
formatPercent
formatMultiple
formatInteger
formatDate
formatPeriod
```

## 23.9 Change indicators

Do not assume `positive number = good` for every financial concept.

For example:

```text
Revenue +15% → generally positive change indicator
Net Debt +15% → may be negative
Operating Expense +15% → context-dependent
```

Semantic direction should be defined per standardized metric, not in generic UI code.

If no semantic rule exists, display neutral increase/decrease without green/red judgment.

## 23.10 Loading states

Prefer skeletons shaped like the final component.

Examples:

```text
metric-grid skeleton
chart skeleton
table-row skeleton
event-list skeleton
```

Avoid full-screen spinners for normal page navigation.

## 23.11 Empty states

Empty is not an error.

Examples:

```text
No companies in watchlist
No disclosures matching this filter
No valuation data because price feed is not configured
No AI analysis generated yet
```

Each empty state should explain why and offer the next valid action where appropriate.

## 23.12 Error states

Errors should identify the failed layer when useful:

```text
Unable to load this page
Financial data unavailable
Market price temporarily unavailable
AI analysis unavailable
```

A market-price failure must not hide KAP financials. An AI failure must not hide deterministic metrics.

## 23.13 Stale data states

Stale data remains visible with a clear label unless there is a correctness reason to hide it.

Example:

```text
Last market price update: 2 trading days ago
```

Do not silently substitute stale data as current.

## 23.14 Accessibility

Minimum target: WCAG 2.1 AA where practical.

Requirements:

- keyboard accessible web navigation
- visible focus state
- semantic HTML
- meaningful accessible names for icon buttons
- sufficient contrast
- status must not rely only on color
- charts should expose textual values/table alternatives for key information
- respect reduced-motion preference

## 23.15 Screen specifications

### Home

Primary goal: surface important changes.

```text
Top bar
Watchlist changes
Latest important events
New financial reports
Recent analyses
```

### Search

```text
Search input
Recent searches
Results
```

No complex screener filters in MVP.

### Watchlist

```text
Watchlist header
Company list
New-event indicators
Key financial deltas
```

### Company / Overview

```text
Company header and return navigation
Four local tabs
What Changed? with analysis/question actions
Key financial metrics
Trend charts
Valuation
Latest events
```

### Company / Financials

```text
Statement selector
Period-mode selector
Financial table
Source drill-down
```

### Company / Ratios

```text
Ratio groups
Current value
historical mini-chart where useful
formula/source action
```

### Company / KAP & Events

```text
Filter chips
Chronological event feed
Event details
Open original KAP source
```

### Company / AI

```text
Company context and return to overview
Saved analysis, covered period and generation time
Ask about this company / Suggested questions
Private previous conversations and recoverable active conversation
Validated sources/metric references used
```

### Settings

```text
Theme
Notifications
Account
Data-source status
```

## 23.16 Component inventory

Reusable UI primitives/domain components should include at least:

```text
AppShell
MobileBottomNav
DesktopSidebar
GlobalSearch
CompanyHeader
CompanyTabs
MetricGrid
MetricItem
ChangeBadge
FinancialChart
FinancialTable
PeriodSelector
StatementSelector
SourceDrawer
FreshnessBadge
EventCard
EventTimeline
DisclosureFilter
WatchlistRow
AIMessage
AISourceList
EmptyState
ErrorState
LoadingSkeleton
```

Domain components should accept normalized view models rather than raw KAP payloads.

## 23.17 UI data contract rule

React components must not understand KAP taxonomy details.

Bad:

```text
Component checks concept === "GrossProfit"
```

Good:

```text
Domain service returns:
{
  metric: "gross_profit",
  label: "Brüt Kâr",
  value: ...,
  yoy: ...,
  source: ...
}
```

The UI consumes standardized domain models.

## 23.18 Navigation acceptance criteria

Before roadmap task 07.08 is complete (with AI-specific flows verified in 09.04/09.06):

- all three primary destinations and detail screens are reachable without typing a URL
- global search works from its persistent control and desktop keyboard shortcut; direct search links, dismissal/focus restoration and back navigation work
- company detail is visibly distinct from Home; long company names, secondary-text contrast and all four local tabs remain usable on narrow screens
- company overview → saved analysis → question → supporting source works without choosing the company again (09.04/09.06)
- legacy `/ai` links reach search without a generation request or back-navigation loop
- browser back behavior is sensible
- mobile bottom navigation works inside Capacitor
- desktop sidebar and mobile navigation represent the same destinations
- company tab state is obvious
- global search can reach any supported company
- web and in-app deep links to company tabs work (OS-verified native link opening is post-MVP)
- source drawer is reachable from displayed financial values
- loading/empty/error/stale states exist for core surfaces

---

# 24. Internal API Design

The API is a separate Next.js deployment. All client routes are versioned under `/api/v1`. Existing routes are `/api/v1/health` (reports `apiVersion`), `/api/v1/session` and `/api/v1/profile`. Installed native clients depend on v1. Introduce a new version before removing or changing a v1 contract. Protected routes verify the Clerk bearer token (signature, expiry, issuer, authorized party) and apply exact-origin CORS.

Suggested product routes (final names are set by their roadmap tasks):

```text
/api/v1/companies
/api/v1/companies/[ticker]
/api/v1/companies/[ticker]/financials
/api/v1/companies/[ticker]/metrics
/api/v1/companies/[ticker]/valuation
/api/v1/companies/[ticker]/disclosures
/api/v1/companies/[ticker]/analysis
/api/v1/companies/[ticker]/chat

/api/internal/kap/sync
/api/internal/kap/reprocess
```

Internal ingestion routes must be protected by machine or operator authority, separate from user tokens. Prefer domain services over putting business logic directly in route handlers.

---

# 25. Repository Structure

```text
/
├── apps/
│   ├── client/          # static Next.js export shared by web and Capacitor (ios/, android/)
│   └── api/             # separate Next.js API deployment (domain services, integrations, jobs)
├── packages/
│   └── contracts/       # shared environment, route, transport and auth contracts
├── supabase/
│   ├── migrations/
│   └── tests/           # pgTAP
├── tests/               # Vitest unit/contract tests
├── tools/               # build, environment, database and native-asset checks
└── docs/
```

Domain modules (companies, financials, metrics, disclosures, valuation), integrations (KAP, market data, AI) and ingestion live under `apps/api` as server-only code. The client never imports them.

---

# 26. KAP Integration Module Structure

```text
src/integrations/kap/
├── client.ts
├── auth.ts
├── schemas.ts
├── types.ts
└── endpoints/
    ├── members.ts
    ├── securities.ts
    ├── disclosures.ts
    └── disclosure-detail.ts
```

Runtime responses must be validated. Do not blindly trust generated OpenAPI types because the provided specification contains weak/incomplete schemas in some areas.

---

# 27. Financial Parser Module

```text
src/ingestion/financials/
├── arrayify.ts
├── context-parser.ts
├── report-tree.ts
├── fact-extractor.ts
├── statement-detector.ts
├── taxonomy-mapper.ts
└── ingest-financial-report.ts
```

Pipeline:

```text
KAP response
↓
validate envelope
↓
normalize Context arrays
↓
normalize ReportItem arrays
↓
walk ReportItem recursively
↓
extract value-bearing facts
↓
resolve labels
↓
attach context dates
↓
persist raw facts
↓
map standardized concepts
↓
calculate metrics
```

---

# 28. Event & Trigger Architecture

The application is **change-driven**, not request-driven and not full-refresh-driven.

Core rule:

```text
CHECK
↓
DIFF
↓
PROCESS ONLY THE DIFF
```

A scheduler may run frequently, but expensive downstream work is performed only when the source state has changed.

## 28.1 Trigger categories

There are four trigger classes.

### A. Scheduled trigger

Used to cheaply determine whether upstream data changed.

Primary KAP flow:

```text
Supabase Cron
   ↓
GET /lastDisclosureIndex
   ↓
compare with kap_sync_state.last_seen_disclosure_index
   ↓
┌─────────────────────┬──────────────────────┐
│ same                │ newer index exists   │
│                     │                      │
│ STOP                │ fetch only unseen    │
│ no parser           │ disclosures          │
│ no AI               │                      │
│ no detail calls     │ persist metadata     │
└─────────────────────┴──────────┬───────────┘
                                 ↓
                           event dispatcher
```

If nothing changed, the run ends after the inexpensive cursor check.

An unchanged index is not by itself proof that no earlier disclosure was corrected. Use the correction mechanism verified against KAP (roadmap 03.01/03.05), or a bounded periodic reconciliation, to detect same-index changes. Do not assume either behavior without evidence.

The polling interval must be configurable and must respect the active KAP API plan/rate limit.

### B. Source event trigger

A newly discovered disclosure creates downstream work based on its type.

```text
new disclosure
│
├── FR
│   ↓
│   fetch disclosure detail
│   ↓
│   parse structured financial statements
│   ↓
│   persist facts / contexts / filing version
│   ↓
│   deterministic metric recalculation
│   ↓
│   compare with prior periods
│   ↓
│   generate analysis snapshot only if inputs changed
│
├── ODA / DG / relevant non-FR disclosure
│   ↓
│   fetch detail
│   ↓
│   normalize source text
│   ↓
│   AI structured event extraction
│   ↓
│   persist kap_event
│   ↓
│   optional embedding / company timeline update
│
└── irrelevant / unsupported type
    ↓
    persist metadata only
```

AI is never triggered merely because cron ran. AI is triggered by a **new or materially changed relevant source item**.

### C. Market-data trigger

Market prices are independent from KAP.

For the fundamental-first MVP, start with end-of-day updates:

```text
market close / EOD job
↓
fetch new price rows only
↓
market_prices
↓
recalculate market cap / valuation metrics
↓
STOP
```

A price change does **not** cause the company financial report to be re-parsed and does **not** automatically generate a new AI fundamental analysis.

Later, optional threshold events may exist, for example:

```text
valuation_multiple_changed_materially
price_gap_threshold_crossed
watchlist_alert_condition_met
```

These must be explicit product rules, not default behavior.

### D. User trigger

Normal application browsing reads already processed data from PostgreSQL/Supabase.

```text
user opens company
↓
read companies + metrics + disclosures + analysis snapshots
↓
render
```

Opening a company page must not automatically call KAP.

User-facing actions have distinct effects:

| Action | Behavior |
|---|---|
| Detaylı analiz | Read the saved company analysis; do not generate or call KAP on open. |
| Bu şirket hakkında sor | Open company Q&A; explicit question submission generates an answer from existing metrics and retrieved evidence. |
| Güncellemeleri kontrol et | Lightweight source-freshness check; enqueue processing only when upstream data is newer. An unchanged response does not regenerate analysis. |

No unrestricted “regenerate analysis” action is offered to ordinary users. Missing analysis shows an honest empty/updating/error state according to job status; recovery follows the controlled job/retry policy.

Existing trigger classes (not a list of ordinary-user permissions):

```text
Ask AI
Manual refresh
Historical import / backfill
Explicit reprocess by admin/developer
```

`Ask AI` uses existing structured metrics and retrieved disclosure/document context. It does not re-download the company's financial statements first.

A manual refresh performs a lightweight freshness check and enqueues work only if the upstream source is newer. Historical import/backfill and explicit reprocessing remain operator-controlled; neither is exposed as an ordinary research action.

## 28.2 Freshness model

Each user-facing dataset should expose a freshness timestamp.

Examples:

```text
financials_updated_at
kap_updated_at
market_price_updated_at
analysis_updated_at
```

The UI may display:

```text
Financials updated: 18:32
KAP checked: 18:40
Price updated: 18:15
```

Freshness is more useful than silently hitting upstream APIs on every page load.

## 28.3 Idempotency

All processing must be safe to retry.

Minimum protections:

```text
UNIQUE(kap_disclosures.disclosure_index)
UNIQUE(processing_jobs.idempotency_key)
```

For AI and parser outputs, include the relevant version in the idempotency key.

Example:

```text
event_extract:1665704:event_prompt_v3
financial_parse:1665704:parser_v2
```

If the same disclosure enters the pipeline twice, the second run must not create duplicate facts, events or AI charges.

## 28.4 Change detection and content hashing

Store a hash of the normalized source payload:

```text
content_hash = SHA-256(normalized source payload)
```

On re-fetch:

```text
same disclosure index + same content hash
→ no-op

same logical filing / source item + changed payload
→ create or mark a new source version
→ reprocess affected facts/metrics
```

This is especially important for corrected/restated financial reports.

Do not overwrite the prior source version.

## 28.5 AI re-analysis policy

AI analysis is relatively expensive and non-deterministic, so it requires its own source fingerprint.

Example fingerprint inputs:

```text
latest financial filing version
metric calculation version
relevant new disclosure IDs
analysis prompt version
```

If the fingerprint has not changed:

```text
reuse existing analysis_snapshot
```

If it changed:

```text
create a new analysis_snapshot
```

Changing only the share price should normally update valuation metrics without regenerating a fundamental narrative.

## 28.6 Failure and retry flow

A failed downstream job must not move source ingestion backward or cause the whole synchronization process to restart.

Example:

```text
disclosure metadata persisted
↓
financial parse failed
↓
processing_jobs.status = failed
↓
retry with exponential backoff
```

The disclosure remains known to the system while only the failed processing stage is retried.

After the retry limit, surface the issue through observability/admin tooling.

## 28.7 Example day

```text
09:00 cron
→ lastDisclosureIndex unchanged
→ stop

09:10 cron
→ unchanged
→ stop

11:40 cron
→ 3 new disclosures
→ persist 3
→ 1 relevant company event → AI event extraction
→ 2 metadata-only

18:30 cron
→ new FR found
→ parse financial report
→ recalculate metrics
→ create new analysis snapshot

18:45 market-data job
→ save EOD price
→ update valuation metrics
→ no financial reparse
→ no automatic AI re-analysis
```

The result is event-driven behavior without requiring an event webhook from KAP.

---

# 29. Scheduling Strategy

Scheduling is responsible for **discovering change and dispatching jobs**. It must not contain financial parsing or AI business logic directly.

## Company metadata sync

Low frequency:

```text
daily / weekly
```

Company metadata changes rarely and should be cached locally.

## Disclosure cursor sync

Poll according to API limits and production contract.

```text
last_seen = kap_sync_state.last_seen_disclosure_index
latest = GET /lastDisclosureIndex

if latest == last_seen:
    STOP

fetch unseen disclosure metadata
persist unseen disclosures
create downstream processing_jobs where required
advance cursor only according to verified API cursor semantics
```

Exact cursor direction, inclusivity and boundary behavior must be verified against production before enabling unattended ingestion.

## Financial processing

A new `FR` disclosure creates a job rather than running the entire pipeline inside cron:

```text
FR discovered
→ enqueue financial_report_parse
→ parse/store facts
→ enqueue metric_recalculation
→ optionally enqueue analysis_snapshot when source fingerprint changed
```

## Market data

MVP:

```text
once per trading day after reliable EOD data is available
```

No AI call is required for ordinary EOD price refreshes.

## Backfill

Historical ingestion is a separate explicit workflow.

```text
manual/admin trigger
→ bounded company/date/index range
→ rate-limited jobs
→ resumable cursor
```

Backfill must never share an uncontrolled loop with the normal live sync.

---

# 30. API Rate Limiting

The development portal plan currently used has a low request-per-minute allowance.

All ingestion must:

- cache company metadata
- avoid repeated disclosure-detail calls
- persist sync cursors
- retry with exponential backoff
- respect 429 responses
- avoid fetching historical records repeatedly

Production limits must be read from the live API subscription before launch.

---

# 31. Error Handling

Every ingestion job stores:

```text
status
attempt_count
last_attempt_at
last_error_code
last_error_message
```

KAP-specific error responses must be logged separately from HTTP/network errors.

Example:

```text
ER005
Disclosure not found
```

Do not convert API errors into empty datasets silently.

---

# 32. Security

- KAP API credentials server-side only
- Clerk tokens validated server-side
- Supabase Row Level Security for user-owned data
- Supabase service-role key never exposed to client
- AI API keys server-side only
- secrets stored in Vercel/Supabase secret management
- redact credentials from application logs
- rotate any credentials exposed during development/testing
- user, operator/admin and machine authorities are separate; user requests never use service-role authority
- private-pilot access requires an invited Clerk account plus an enabled eligibility row
- Vercel Preview deployments carry no Finpill, provider or data-access credentials
- CI never targets Production resources or uses Production credentials; Local may use the hosted Supabase project with user-scoped access only, never the privileged key
- browser bundles and native artifacts are scanned for server-secret patterns; only allowlisted public settings reach the client

---

# 33. Observability

Minimum:

- structured application logs
- ingestion job logs
- KAP response status/error metrics
- parser failure counts
- missing taxonomy mapping counts
- AI extraction failures
- cron health timestamp

Recommended later:

- Sentry
- OpenTelemetry
- Vercel observability

---

# 34. Testing Strategy

## Unit tests

Critical:

```text
arrayify
context parser
recursive ReportItem traversal
value extraction
period handling
quarter derivation
sign rules
metric formulas
```

## Fixture testing

Store raw sample API responses under:

```text
tests/fixtures/kap/
```

The validated TSPOR financial response should become the first parser fixture if permitted by repository policy.

## Integration tests

```text
KAP response
→ parser
→ database facts
→ metric output
```

## Golden metric tests

For selected companies/periods, manually verify:

```text
Revenue
Gross Profit
Net Profit
Assets
Equity
Net Debt
EBITDA
```

and freeze expected results.

---

# 35. Data Quality Checks

After each filing:

```text
Assets = Liabilities + Equity
```

within permitted rounding tolerance.

Also check:

```text
Revenue context exists
Net profit context exists
Balance-sheet current instant exists
Currency is known
Duplicate fact count
Unmapped major taxonomy concepts
```

Warn rather than silently repair source data.

---

# 36. Product Scoring

Avoid one opaque "stock score" initially.

If scoring is added, expose separate dimensions:

```text
Growth
Profitability
Balance Sheet
Cash Flow Quality
Valuation
Earnings Quality
```

Every dimension must disclose inputs, formula, version and historical context. AI should explain scores but not calculate them.

---

# 37. Phase Plan

Superseded (BC-13). Execution order, dependencies and acceptance criteria are owned by [MVP_EXECUTION_PLAN.md](MVP_EXECUTION_PLAN.md). The original phase list is preserved in Git history (blueprint v0.4). Technical analysis remains a later, separate module; it should describe conditions rather than output trade commands.

---

# 38. First Development Milestone

Superseded (BC-13). The original first milestone, KAP FR → normalized facts without UI or AI, is covered by roadmap phases 02–04.

---

# 39. Initial Engineering Tickets

Superseded (BC-13) by the roadmap's task list.

---

# 40. Coding-Agent Rules

Coding agents follow [AGENTS.md](../AGENTS.md), which must preserve these invariants:

```text
1. Never calculate financial metrics in React components.
2. Never use AI-generated values as source financial facts.
3. Never overwrite raw KAP responses.
4. Never assume ReportItem/Context/Value is always an array.
5. Never infer accounting period solely from "3 Aylık", "6 Aylık", etc.
6. Use exact Context dates.
7. Use decimal/numeric values for money, never JavaScript floating-point arithmetic for authoritative calculations.
8. Preserve source concept, context and disclosure index for every fact.
9. Every derived metric must have a calculation version.
10. Every database schema change must use a migration.
11. External API responses require runtime validation.
12. Credentials may never appear in client-side code.
13. Add tests before changing parser behavior.
14. Do not silently correct malformed source data.
15. Mark uncertain financial methodology explicitly as TODO/versioned methodology.
16. Do not let React components depend on raw KAP taxonomy concepts.
17. Use shared formatter utilities for money, percentages, multiples, dates and periods.
18. Implement loading, empty, error and stale states for every data-driven screen.
19. Do not use red/green to imply quality unless a metric-specific semantic rule exists.
20. Follow the documented navigation and route map; do not invent parallel screen structures.
21. Preserve accessibility semantics and keyboard navigation on web.
22. Every external data timestamp shown to a user must identify freshness accurately.
23. Transport authoritative amounts as decimal strings; never as JSON numbers.
```

`decimal.js` is the decimal library; exact-number rules are in [A06](adr/A06-exact-numbers.md).

---

# 41. Definition of MVP Done

MVP is complete when a user can:

1. search a BIST company
2. open its profile
3. see several historical financial periods
4. inspect revenue, profitability, balance-sheet and cash-flow trends
5. see YoY/QoQ changes
6. inspect valuation metrics using EOD market data
7. view recent KAP disclosures
8. see AI-extracted corporate events
9. ask questions about the company's official disclosure history
10. inspect the source behind important values
11. see a generated "What changed?" analysis
12. add the company to a watchlist
13. navigate the complete product comfortably on mobile and desktop
14. distinguish current, stale and unavailable data
15. open source/lineage details for key financial values

The above must work for invited private users on web, iOS and Android, against Production. Historical coverage must meet the 20-company × 12-quarter cohort (§42). The roadmap's §7 checklist is the objective acceptance list.

And the engineering system can continuously sync KAP disclosures, parse new financial reports, version restatements, recalculate metrics, retain lineage and generate AI analysis snapshots without manual data entry.

---

# 42. Open Decisions

These should remain intentionally unresolved until validated.

## Production KAP authentication

Need live-environment validation.

## Market-price provider

Need an EOD provider first; licensing requirements must be confirmed before real-time redistribution.

## EBITDA methodology

`ebitda_v1` must be validated across multiple issuer statement structures.

## Net debt methodology

Need a documented decision on leases and financial investments.

## Sector taxonomy

Need a stable BIST/issuer sector mapping source.

## Historical ingestion depth

Decided (owner, BC-14): **20 deliberately selected companies × 12 displayed quarters**, plus the predecessor inputs needed for the initial YoY/TTM and as-of valuation. The cohort deliberately covers materially different reporting structures; the selection is owned by roadmap task 02.01. It is a validation and initial-coverage boundary, not a platform limit: ingestion, identifiers and schemas stay full-market capable.

## AI model selection

Generation model is intentionally swappable through Vercel AI Gateway. Embedding model should change rarely and remain versioned.

---

# 43. Non-Functional Requirements

## 43.1 Performance

Measurable targets are still to be set (BC-16, still recorded). Roadmap task 10.06 sets them for the private stage, and formal targets become a public-release gate. Initial direction, measured on release builds:

```text
Primary app shell should become interactive quickly on normal mobile networks.
Company pages should render cached/DB-backed financial data without upstream API calls.
Large financial tables should not block the main thread unnecessarily.
Charts should lazy-load when below the fold if this materially improves performance.
```

Use server-side data fetching/caching where appropriate, but do not cache user-private watchlist/preferences globally.

Performance regressions should be measured rather than guessed.

## 43.2 Reliability

Core deterministic data must remain usable when optional subsystems fail.

```text
AI down             → financials still work
market feed down     → KAP financials still work
embedding failure    → structured data still works
attachment failure   → structured presentation data still works where available
```

Installed native clients keep working across API deployments: the API stays backward-compatible within `/api/v1`, and public-setting changes require a rebuilt client. Backup/restore and lineage verification are exercised before the private-pilot release (roadmap 10.04). Formal recovery targets (RPO/RTO) are a public-release gate.

## 43.3 Data correctness

Correctness is more important than freshness for financial statements.

If validation fails:

```text
store source
mark processing failure
surface previous valid processed version if appropriate
retry / investigate
```

Do not publish partially calculated metrics as if complete.

## 43.4 Accessibility

Design toward WCAG 2.1 AA for primary web flows and preserve equivalent usability in Capacitor shells. The private MVP verifies baseline accessibility (keyboard, focus, contrast, screen-reader smoke checks, reduced motion). Formal AA conformance testing is a public-release gate.

## 43.5 Localization

MVP UI language: Turkish.

Database/domain models should preserve English source labels and avoid Turkish-only enum identifiers so future English localization remains possible.

---

# 44. Environments, Configuration & Deployment

Owner decision 2026-09-24 (BC-20; accepted [A03](adr/A03-environments-and-releases.md)). The how-to guide is [ENVIRONMENTS.md](ENVIRONMENTS.md).

Two application/data environments:

```text
local        development, automated tests, disposable databases, Clerk development instance
production   the single hosted private application: Vercel Production, one hosted Supabase
             project, Clerk live instance once hosted authentication is enabled
```

"Private pilot" is a usage/release mode of Production, not a separate environment.

Vercel deployment contexts are not application environments:

```text
development  → local
preview      → no application environment (credential-free build context)
production   → production
```

Rules:

```text
Preview holds no Finpill, provider or data-access credentials and runs with those integrations disabled
CI never targets Production resources; Local may use the hosted Supabase project with user-scoped access only (no privileged key)
Production configuration fails closed; never fall back from production to development services
Production auth is optional until enabled; when enabled it requires live Clerk keys and rejects development keys/issuer
secrets live only in ignored local files, CI-scoped secrets or the hosting provider's secret store
environment variables are schema-validated at build and startup; only allowlisted public settings reach the client
```

A dedicated hosted Staging environment is not required during this phase. Add one only when public release, multiple users, store distribution, significant operational risk or release-management needs justify it, and revise A03 when you do.

Hosted Production authentication needs an owned domain and a Clerk live instance. It is deferred and tracked as an explicit prerequisite; until then integrated authentication is proven against Local.

## Deployment flow

```text
task branch
↓
PR: format + lint + typecheck + tests + disposable database replay (CI)
↓
credential-free Vercel Preview (build, static UI, routing)
↓
owner review and merge to main
↓
Vercel Production deploy (client and API projects)
```

Database migrations are applied explicitly to Production, with owner approval, and must be backward-safe for the deployed API and installed clients.

---

# 45. Admin & Operations Tooling

Even a personal-use MVP needs minimal operational visibility.

Provide an internal/admin-only surface or scripts for:

```text
sync status
last KAP cursor
failed jobs
retry job
unmapped taxonomy concepts
latest financial parser errors
latest AI extraction errors
rate-limit events
stale data sources
manual company backfill
manual disclosure reprocess
```

Do not require editing database rows manually for routine recovery.

This can initially be a protected internal page rather than a polished admin product.

---

# 46. Product Analytics & Telemetry

Product analytics are optional for a purely personal build but the architecture should not make them difficult later.

Useful privacy-conscious events:

```text
company_opened
search_used
watchlist_added
financial_tab_changed
source_drawer_opened
ai_question_submitted
kap_event_opened
```

Do not record sensitive AI prompt contents by default merely for analytics.

Operational telemetry is separate from product analytics.

---

# 47. AI Quality, Safety & Evaluation

AI output must be treated as derived commentary.

Minimum rules:

- numeric claims should come from structured data where possible
- cited source records must actually support the statement
- separate observed fact from interpretation
- do not fabricate missing causal explanations
- if the source does not explain a change, say the driver is not established
- retain model + prompt version
- allow regeneration when analysis methodology changes

Create an evaluation set containing representative questions such as:

```text
What changed in the latest quarter?
Why did net profit decline?
Has debt improved?
What major investments were announced in the last year?
Did a prior management target materialize?
```

Evaluate:

```text
numeric accuracy
source correctness
unsupported-claim rate
relevance
consistency across model changes
```

Model upgrades should not be deployed solely because they sound better in a few manual examples.

---

# 48. Data Provider, Licensing & Usage Boundaries

KAP/MKK, market-price feeds and any future exchange-depth data have independent usage/licensing rules.

Before public/commercial distribution:

- confirm production KAP API terms
- confirm caching/storage rights
- confirm display/redistribution rights
- confirm market-data delay/realtime labeling requirements
- confirm whether end-user exchange agreements are required
- document attribution requirements

Do not assume that because data is technically accessible it may be redistributed commercially.

For a personal/private build, retain the same abstraction boundaries so a provider can be replaced later.

Private-pilot use of KAP and market data still requires recorded evidence that the use is permitted (access register). Public launch, public redistribution, store publication and billing are separate release gates beyond the MVP (BC-17).

---

# 49. Architecture Decision Records & Documentation Discipline

Important architecture decisions should be captured as small ADRs under:

```text
docs/adr/
```

Examples:

```text
0001-nextjs-capacitor.md
0002-clerk-supabase.md
0003-kap-presentation-parser.md
0004-financial-fact-versioning.md
0005-ebitda-v1.md
0006-market-data-provider.md
```

Each ADR should contain:

```text
Context
Decision
Alternatives considered
Consequences
Status
Date
```

The blueprint defines the current architecture; ADRs capture consequential decisions that become costly to reverse. Ordinary implementation needs no ADR. The active ADR set (A01–A12) and its gates are listed in the roadmap §2. An ADR is accepted only when its evidence exists, and a gate blocks only the work it names. When a decision changes architecture, update the blueprint in the same PR.

---

# 50. Pre-Coding Readiness Checklist

Superseded (BC-13). Repository readiness was completed by roadmap phase 00. Per-task readiness is each task's roadmap row plus the prerequisites in the [access register](ACCESS_REGISTER.md).

---

# 51. Recommended Next Step

Superseded (BC-13). See [TASK_STATUS.md](TASK_STATUS.md) for the next actionable roadmap task.
