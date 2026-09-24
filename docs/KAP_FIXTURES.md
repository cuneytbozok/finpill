# KAP source evidence and fixtures (task 02.01)

This is the evidence pack for the MKK VYK (KAP) API as it actually responds. Every later KAP task (parser, schemas, ingestion, runtime validation) builds against the shapes recorded here, not against the published specification or the blueprint sketch.

## Fixture policy

- **Source:** the MKK development API, `https://apigwdev.mkk.com.tr/api/vyk`, with the owner's development account (HTTP Basic, free plan, 6 calls/minute). Production access is a separate, unconfirmed prerequisite ([ACCESS_REGISTER.md](ACCESS_REGISTER.md)).
- **Rights (owner decision, 2026-09-25):** private development testing only. This repository is public, so payloads are **never committed**. They live byte-for-byte in the ignored `tests/fixtures/kap/payloads/` directory. Git holds [`tests/fixtures/kap/manifest.json`](../tests/fixtures/kap/manifest.json): origin path, retrieval time, HTTP status, content type, byte length, SHA-256, rights, coverage tags, and independently checked expectations.
- **Specification:** the owner's copy of the MKK OpenAPI document (`KAP VYK API 0.0.1-apinizer-337-07a3583`, OpenAPI 3.0.3) is referenced by version and SHA-256 in the manifest and is not committed, for the same reason.
- **Independent checks:** an expectation records the value in the payload, the value in an independent source (another fixture, normally the filing's own PDF attachment), and whether they agree. Disagreements are recorded, never repaired.
- **Missing payloads fail explicitly.** `verify` reports each fixture as `verified`, `mismatch` or `missing`; CI has no payloads, so fixture-dependent tests must report "not available" instead of passing on a mock.

## Tooling

Node 24, from the repository root. Credentials are read from the ignored `apps/api/.env.local` (`KAP_ENV=development`, `KAP_AUTH_MODE=basic`, `KAP_BASE_URL`, `KAP_API_KEY`, `KAP_API_SECRET`; `KAP_ENABLED` may stay `false`). Another checkout can point to it with `KAP_ENV_FILE`.

```bash
node tools/kap-fixtures.mjs get "/disclosureDetail/1230809?fileType=data" tspor-detail
node tools/kap-fixtures.mjs promote tspor-detail tspor-fr-2023-h1-cs TSPOR "financial-report,family:general"
node tools/kap-fixtures.mjs verify --require-payloads
```

- Only read-only GET paths from the development specification are allowed; `generateToken` is not.
- Calls are throttled to 5 per rolling minute across runs. Errors report the HTTP status only.
- `get` stores exploration output and metadata under `payloads/scratch/`; `promote` turns it into a manifest fixture without another call. `--allow-error` keeps non-2xx bodies, which must be tagged `error-response`.
- To rebuild the payloads on a new machine, re-run `get` for each manifest `origin.path` and `promote`, then `verify --require-payloads`. The development snapshot is frozen, so hashes should match; a mismatch is itself evidence and must be recorded, not overwritten.

## What the evidence covers

Retrieved 2026-09-24/25 (UTC): 214 fixtures, every one hash-verified. The development snapshot is frozen (`lastDisclosureIndex` 1231017; disclosures from index ~1103282, about March–December 2023); re-fetched responses were byte-identical.

| Area | Coverage |
|---|---|
| Endpoints | All 11 GET paths of the development specification, plus four error responses. `generateToken` is production-only and absent here. |
| Disclosure sample | 40 list pages spread evenly over the snapshot (1,955 disclosures), 20 company-filtered FR lists and the FR-filtered list from the start of the snapshot. |
| Details | One `disclosureDetail` per distinct class/type/subreport combination in the sample (131), plus FR consolidated/standalone pairs and representation variants. |
| Classes / types | FR, ODA, DG, DUY × FR, ODA, DG, DUY, CA, FON, including cross combinations such as `ODA/CA`, `FR/FON`, `DG/ODA`. |
| Subreport templates | 106 distinct non-financial templates (`oda-…`), e.g. material events, general-assembly and capital-increase notices, prospectuses, fund reports, index and trading announcements. |
| FR taxonomy families | `general` (layout A: 210015/310003/520003/610000; layout B: 310000 + 420000; direct cash flow 510011), `banks`, `par-banks`, `insurance`, `finance`, `holding` (310004/310030 with 410000 or 420000), `etf`. |
| Representations | `presentation` (121), `flatData` (12, DTOs KPY41/49/50/52/70/74/75/81), `htmlMessages` (1), attachments (4 PDFs). |
| Financial properties | Consolidated and standalone; December and June–May fiscal years; interim `CURR3`/`PREV3` quarter contexts; rounding `INF`, `-3`, `-6`; dimensional facts (equity components, bank currency split, typed share classes); negative and absent values; in-filing restatement rows. |
| Corrections / events | `disclosureReason` `NEW`, `UPD`, `CORR` with `relatedDisclosureIndex`; corporate-action `eventType` `MKK`, `GK`, `SA`, `HKR`, `SPAF` and a real `caEventStatus`. |

The cohort in the manifest is the 20-issuer validation set required by roadmap 02.01. The owner's direction (2026-09-25) is that response-structure coverage matters, not the particular companies; the cohort was chosen so that its issuers span every FR family and layout above. It is a validation boundary, not a platform limit.

## Observed contract (differs from the specification and blueprint)

Later tasks must validate against these observations. BC-21 in the [correction register](BLUEPRINT_CORRECTIONS.md) records the blueprint sections they correct.

**Transport and errors**

- Authentication is HTTP Basic with the key as user name and the secret as password.
- "Not found" is HTTP **400**, not 404, with JSON `{"code":"ER005","message":"…"}`. Parameter validation errors are also 400 but with a **plain-text** body under `Content-Type: application/json`. An unknown `caEventStatus` id returns `200 []`.
- Company-filtered `/disclosures` calls return one filing group per call, not 50 items; unfiltered pages returned 47–50. The FR filter also returned an `ODA`-typed integrated report. Paging semantics belong to 03.03.

**Directory and reference data**

- `/members` is an array (the specification says one object) with an undocumented `id`; 23 ids appear twice; `stockCode` is a comma-separated list mixing equity tickers, share classes and debt/intermediary codes (`ISATR, ISBTR, ISCTR, ISKUR, TIB`).
- `/memberSecurities` sends `capital`/`currentCapital` as JSON **numbers with fractional digits** (e.g. `253604600.868`, 281 of 1,062); parse losslessly. Share capital is not a share count.
- `memberDetail`/`fundDetail` are key/value lists whose values are strings, lists or null; `memberDetail` contains personal data (board members).
- Date formats vary: `29.12.2023 18:28:45` (detail `time`), `2026.12.31 00:00:00`, `28/03/1994 00:00:00`.

**Disclosure detail**

- Optional top-level fields depend on the disclosure: `consolidation`, `year`, `relatedDisclosureIndex`, `eventId`/`eventType`, `disclosureDelayStatus`, `behalfFund*`, `senderExchCodes`, `presentation`, `flatData`, `htmlMessages`. Two DUY disclosures had no `disclosureReason`.
- `presentation` is always a list; `ContextList.Context`, `ReportItem` and `Value` are object **or** array (all three observed both ways); `langs.lang` was always an array but is normalized anyway.
- `rounding` is a precision indicator; **`value` is already in full units**. AKBNK's profit `60024084000` (`-3`) is 60.024.084 thousand TL in its PDF; KCHOL's assets `1582594000000` (`-6`) are 1.582.594 million TL. Never multiply by it.
- Bank balance-sheet lines carry `CurrencyTypeAxis` (`DomesticCurrencyMember`, `ForeignCurrencyMember`, `TotalMember`); a bank's total assets exist only as the `TotalMember` fact.
- The same concept can occur twice in one statement, distinguished only by `preferredLabel` (cash-flow `periodStartLabel`/`periodEndLabel`).
- Non-financial `presentation` forms reuse `ReportItem`/`Value` for text, `Evet/Hayır`, `%9,9` (Turkish decimal comma), `-`, `X` and dates, with an empty `currency` and `rounding`.
- Source label typos must be preserved: `CurrentBorowings`, `alternativeNetlLabel`, `standartCapitalsLabel`.
- `flatData` is a list of `{id: "tr.com.mkk.kap.client.dto.KPY…DTO", content: {version, object: {void: […]}}}`: a JSON rendering of Java `XMLEncoder` output with `property`, typed leaves (`string`, `boolean`, `object`) and labels. All corporate actions use it. KPY41 includes personal data and national-ID credential types.
- `fileType=html` returns `htmlMessages: [{id, tr, en}]` with base64 HTML per subreport. The decoded HTML declares `ISO-8859-9` but also carries `utf-8` and `windows-1254` meta tags.

**Attachments and removals**

- `downloadAttachment` returns a **Java-serialized `byte[]`**: a 27-byte header (`AC ED 00 05`, `[B`, 4-byte big-endian length) followed by the PDF, under `Content-Type: application/pdf`. The length matched exactly in all four samples. Attachment URLs in details point at another host (`vykapialpha.mkk.com.tr`).
- `/blockedDisclosures` lists 25 disclosures/attachments removed on request because they contain personal data. Owner decision (2026-09-25): copies acquired before a removal are retained, because they were publicly published; ingestion should still record the blocked status. A05 (02.03) records the concrete handling.

## Independent checks

16 values from four filings (general, bank, insurance, holding families) were checked against each filing's own PDF attachment. `verify` resolves each locator in the payload and requires exactly one matching fact.

| Filing | Result |
|---|---|
| TSPOR 1230809 (6 months to 2023-11-30) | 6 agree. **1 disagrees:** the equity statement's opening net-profit component is `-769152983` in the structured data but `-769.152.893` in the PDF and on the balance sheet — a transposition in KAP's structured data. The prior-year closing `-1140733706` versus the next opening `-1140733708` appears in both sources and is a genuine filing inconsistency. |
| AKBNK 1107380 (standalone, FY2022) | 4 agree, including the domestic/foreign/total asset split. |
| AKGRT 1113038 (FY2022) | 3 agree, including a loss shown in parentheses. |
| KCHOL 1112769 (FY2022) | 2 agree; the PDF prints USD convenience-translation columns before the TL figures. |

The structured data is therefore not always identical to the filed statement. The quality checks (04.06) must detect such conflicts and never repair them.

## Gaps (recorded, not approximated)

- **TMS 29 (inflation accounting):** first applied to FY2023 reports filed in 2024, after this snapshot. No TMS 29 filing exists in development data.
- **12-quarter history:** the snapshot covers roughly March–December 2023 (FY2022 to 9M-2023).
- **FR-level corrections:** `UPD`/`CORR` appeared only on corporate-action and fund disclosures in the sample; no corrected or re-filed financial report was observed.
- **Single-object `lang`:** normalized but not observed.
- **Production behaviour:** token authentication, rate plan and any differences from development are unverified.

These need production MKK access (03.01 onward) and are tracked in [TASK_STATUS.md](TASK_STATUS.md).
