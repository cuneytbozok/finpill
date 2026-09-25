# A06 — Exact numbers

- Status: **Proposed 2026-09-25** (task 02.04). The owner accepts it by merging the 02.04 PR.
- Owner: project owner; 04.03 owns source value parsing, 05.x metric arithmetic, 07.x presentation.
- Implements: blueprint §12.0 "Exact numbers" and §23.8 (BC-08). Code `packages/contracts/src/decimal.ts`, `numeric.ts`, `format.ts`, `apps/api/src/server/numbers/lossless-json.ts`; migration `20260925200000_exact_decimal.sql`; tests `tests/decimal.test.ts`, `tests/number-format.test.ts`, `tests/lossless-json.test.ts`, `supabase/tests/exact_decimal.test.sql`.

## Context

The 02.01 evidence pack ([KAP_FIXTURES.md](../KAP_FIXTURES.md)) shows that KAP sends some amounts as JSON **numbers** with fractional digits (`/memberSecurities` capital `253604600.868`), statement values as strings already in full units (`60024084000` with `rounding` `-3`), and Turkish-formatted text (`%9,9`) in non-financial forms. Statement totals reach 10^12 TL and exceed float-exact integers once summed or scaled. `JSON.parse` and `Number` lose digits; PostgREST returns `numeric` as a JSON number; Android WebView ICU data varies by device.

## Decision

1. **Canonical decimal string.** An authoritative number is a `DecimalString`: plain notation, optional `-`, no exponent, no leading or trailing zeros, never `-0`. Transport DTOs accept only this form (`DecimalStringSchema`); a JSON number is rejected.
2. **Supported range.** At most 30 integer digits and 18 fraction digits. Inputs and results outside it fail with `DecimalError` (`out_of_range`); they are never rounded to fit. Invalid tokens (whitespace, locale separators, NaN, Infinity, hex) fail with `invalid`; nothing is repaired.
3. **Parsing.** `parseDecimal` accepts JSON number syntax (plus a leading `+` and leading zeros) and canonicalizes by string manipulation, without a floating-point step. Interpreting Turkish-formatted text such as `%9,9` is a parser rule (04.03), not a decimal-string conversion.
4. **Lossless provider JSON.** Provider bodies are parsed with `parseLosslessJson` (server-only, Node 24 `JSON.parse` source-text access): every number token becomes a `JsonNumber` holding its exact source text. It fails closed on runtimes without source access. The raw lexical token is what 04.x stores as the raw value; the canonical string is the numeric value.
5. **Arithmetic.** `decimal.js` (clone with precision 100) through a small function API: `add`, `subtract`, `multiply` and `negate` are exact for in-range operands and range-checked. The only rounding operations are `round(value, scale, mode)` and `divide(a, b, scale, mode)`, which state the scale (0–18) and mode. Division rounds once from the exact integer remainder, so there is no double rounding. Modes: `half_up` (ties away from zero, like PostgreSQL `round(numeric)`), `half_even`, `down`, `up`, `floor`, `ceil`. Each methodology (A09) names its scale and mode; there is no implicit default.
6. **Storage.** Authoritative columns use the `public.exact_decimal` domain: unconstrained `numeric` with the same range, rejecting NaN and ±Infinity. `numeric(38, 6)` is not used, because it would round source fractions. Server code reads numeric columns as text (`select=amount::text` through PostgREST, `trim_scale(amount)::text` in SQL) and parses them with `parseDecimal`, never through a JSON number.
7. **Numeric DTO.** `NumericValueSchema` is either `available` with a `DecimalString` and unit, or `missing`, `incompatible`, `not_meaningful` or `not_applicable` with a reason code and no value. Units are `currency` (ISO 4217 code), `ratio` (a fraction, shown as a percentage), `multiple`, `shares` or `pure`. Period, basis, methodology, lineage and generation are added by the contracts that compose it (02.05, 05.x).
8. **Formatting.** `formatDecimal`, `formatInteger`, `formatCurrency`, `formatCompact`, `formatCompactCurrency`, `formatPercent` and `formatMultiple` in `@finpill/contracts` are the only number formatters. They are implemented in code rather than with `Intl`, so web, iOS and Android output is identical. Locales `tr` (default product language: `1.049.330.437,00`, `%17,34`, `₺1,05 Mr`) and `en` (`1,049,330,437.00`, `17.34%`, `₺1.05B`); `₺` in both. Fixed fraction digits (default 2, integers 0), half-up at the displayed digit, compact units carry upward (`1,00 Mn`, not `1.000,00 B`), zero never carries a sign, `sign: "always"` shows `+` for change values. Formatting returns a new string and never replaces the authoritative value. Dates and periods are formatted by the period contracts (02.05), not here.
9. **Charts.** `toChartNumber` is the only conversion to a JS number, for chart geometry. Labels, tooltips and drill-down use the exact string.

## Consequences

- 04.01 declares fact values as `exact_decimal` and keeps the raw token separately; 04.03 parses with `parseLosslessJson`/`parseDecimal`.
- 05.x metric code uses the function API; operations not provided (for example roots for growth rates) are added with an explicit precision in the methodology that needs them.
- Values that exceed the range (for example a source amount with 19 fraction digits) fail ingestion visibly; widening the range is a new migration and an ADR update, not a silent change.
- The contracts package now contains the shared exact-number and formatting primitives, adding `decimal.js` (about 32 KB minified) to the client bundle.
