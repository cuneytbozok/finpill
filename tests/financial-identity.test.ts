import { existsSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

import {
  FinancialPeriodSchema,
  FinancialValueContextSchema,
  PurchasingPowerBasisSchema,
} from "@finpill/contracts";

import {
  checkCompatibility,
  purchasingPowerBasis,
} from "../apps/api/src/server/financial/compatibility";
import {
  filingCoverage,
  fiscalYearStartFor,
  planStandaloneQuarter,
  planTrailingTwelveMonths,
} from "../apps/api/src/server/financial/coverage";
import {
  FinancialContractError,
  addMonthsToMonthStart,
  effectivePeriod,
  factIdentityKey,
  groupFactOccurrences,
  kapFactIdentity,
  normalizeKapContext,
  parseKapPublicationTime,
  reportingScope,
  taxonomyFamily,
  temporalRole,
  wholeMonths,
} from "../apps/api/src/server/financial/identity";
import { selectReportedValue } from "../apps/api/src/server/financial/selection";

import type { PurchasingPowerBasis } from "@finpill/contracts";

import type { SeriesBasis } from "../apps/api/src/server/financial/compatibility";
import type { PeriodObservation } from "../apps/api/src/server/financial/coverage";
import type {
  KapContext,
  KapFactOccurrence,
} from "../apps/api/src/server/financial/identity";
import type { ReportedObservation } from "../apps/api/src/server/financial/selection";

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    if (error instanceof FinancialContractError) return error.code;
    throw error;
  }
  return "ok";
};

const duration = (start: string, end: string) => ({
  kind: "duration" as const,
  start,
  end,
});
const ctx = (
  id: string,
  period: NonNullable<KapContext["Period"]>,
  key = "CURR",
) => ({
  id,
  key,
  Period: period,
});

describe("financial contracts (transport)", () => {
  it.each([
    [{ kind: "instant", date: "2023-11-30" }, true],
    [{ kind: "instant", date: "2023-02-29" }, false],
    [duration("2023-06-01", "2023-11-30"), true],
    [duration("2023-11-30", "2023-06-01"), false],
    [{ kind: "instant", date: "2023-11-30T00:00:00Z" }, false],
  ])("period %j valid=%s", (period, valid) => {
    expect(FinancialPeriodSchema.safeParse(period).success).toBe(valid);
  });

  it("requires a measuring-unit date for TMS 29 and nothing else", () => {
    expect(
      PurchasingPowerBasisSchema.safeParse({ kind: "tms29" }).success,
    ).toBe(false);
    expect(
      PurchasingPowerBasisSchema.safeParse({
        kind: "nominal",
        measuringUnitDate: "2023-12-31",
      }).success,
    ).toBe(false);
  });

  it("carries period, scope, basis, selection and knowledge time", () => {
    expect(
      FinancialValueContextSchema.parse({
        period: duration("2023-01-01", "2023-09-30"),
        scope: "standalone",
        basis: { kind: "nominal" },
        selection: "latest_compatible",
        publishedAt: "2023-10-30T15:38:49Z",
      }).scope,
    ).toBe("standalone");
  });
});

describe("calendar and source contexts", () => {
  it.each([
    ["2023-06-01", "2023-11-30", 6],
    ["2023-09-01", "2023-11-30", 3],
    ["2022-01-01", "2022-12-31", 12],
    ["2024-01-01", "2024-02-29", 2],
    ["2023-01-02", "2023-03-31", null],
    ["2023-01-01", "2023-03-30", null],
  ])("wholeMonths(%s, %s) = %s", (start, end, months) => {
    expect(wholeMonths(start, end)).toBe(months);
  });

  it("adds months across year boundaries", () => {
    expect(addMonthsToMonthStart("2023-06-01", 12)).toBe("2024-06-01");
    expect(addMonthsToMonthStart("2023-02-01", -3)).toBe("2022-11-01");
    expect(code(() => addMonthsToMonthStart("2023-02-15", 1))).toBe(
      "invalid_period",
    );
  });

  it("takes dates from Period and keeps the key only for lineage", () => {
    // A key that claims CURR does not make a prior-year period current.
    expect(
      normalizeKapContext(
        ctx("2022-06-012022-11-30", {
          startDate: "2022-06-01",
          endDate: "2022-11-30",
        }),
      ),
    ).toEqual({
      sourceContextId: "2022-06-012022-11-30",
      sourceKey: "CURR",
      period: duration("2022-06-01", "2022-11-30"),
    });
  });

  it.each([
    [{ instant: "2023-11-30", startDate: "2023-06-01", endDate: "2023-11-30" }],
    [{}],
    [{ startDate: "2023-06-01" }],
    [{ startDate: "2023-12-01", endDate: "2023-06-30" }],
    [{ instant: "30.11.2023" }],
  ])("rejects malformed period %j instead of repairing it", (period) => {
    expect(code(() => normalizeKapContext(ctx("c", period)))).not.toBe("ok");
  });

  it.each([
    ["CS", "consolidated"],
    ["NC", "standalone"],
  ])("maps consolidation %s", (value, scope) => {
    expect(reportingScope(value)).toBe(scope);
  });

  it("rejects an absent or unknown consolidation", () => {
    expect(code(() => reportingScope(undefined))).toBe("unknown_consolidation");
    expect(code(() => reportingScope("XX"))).toBe("unknown_consolidation");
  });

  it.each([
    ["general_role_210015", "general"],
    ["par-banks_role_210013", "par-banks"],
  ])("taxonomy family of %s", (subreport, family) => {
    expect(taxonomyFamily(subreport)).toBe(family);
  });

  it("converts Istanbul publication time to UTC and refuses guessed offsets", () => {
    expect(parseKapPublicationTime("29.12.2023 18:28:45")).toBe(
      "2023-12-29T15:28:45Z",
    );
    expect(parseKapPublicationTime("01.01.2023 01:00:00")).toBe(
      "2022-12-31T22:00:00Z",
    );
    expect(code(() => parseKapPublicationTime("2023.12.29 18:28:45"))).toBe(
      "invalid_publication_time",
    );
    expect(code(() => parseKapPublicationTime("30.02.2023 10:00:00"))).toBe(
      "invalid_date",
    );
    expect(code(() => parseKapPublicationTime("15.03.2016 10:00:00"))).toBe(
      "unsupported_time_zone_period",
    );
  });
});

describe("fact identity", () => {
  const cashFlow = normalizeKapContext(
    ctx("2023-06-012023-11-30", {
      startDate: "2023-06-01",
      endDate: "2023-11-30",
    }),
  );
  const occurrence = (
    overrides: Partial<KapFactOccurrence> = {},
  ): KapFactOccurrence => ({
    itemName: "CashAndCashEquivalentsForCashFlowStatement",
    parentName: "StatementOfCashFlowsAbstract",
    typedMember: false,
    preferredLabel: null,
    measures: [],
    context: cashFlow,
    currency: "TRY",
    ...overrides,
  });

  it.each([
    ["periodStartLabel", "period_start"],
    ["tersePeriodStartLabel", "period_start"],
    ["periodEndLabel", "period_end"],
    ["tersePeriodEndLabel", "period_end"],
    ["totalLabel", "context"],
    ["negatedLabel", "context"],
    [null, "context"],
  ])("preferredLabel %s has temporal role %s", (label, role) => {
    expect(temporalRole(label)).toBe(role);
  });

  it("reads period-start balances at the instant before the period", () => {
    const period = duration("2023-06-01", "2023-11-30");
    expect(effectivePeriod(period, "period_start")).toEqual({
      kind: "instant",
      date: "2023-05-31",
    });
    expect(effectivePeriod(period, "period_end")).toEqual({
      kind: "instant",
      date: "2023-11-30",
    });
    expect(effectivePeriod(period, "context")).toBe(period);
  });

  it("separates start and end balances reported on one duration context", () => {
    const start = kapFactIdentity(
      occurrence({ preferredLabel: "periodStartLabel" }),
    );
    const end = kapFactIdentity(
      occurrence({ preferredLabel: "periodEndLabel" }),
    );
    expect(factIdentityKey(start)).not.toBe(factIdentityKey(end));
    expect(factIdentityKey(start)).toBe(
      "CashAndCashEquivalentsForCashFlowStatement|i:2023-05-31@period_start||TRY",
    );
  });

  it("sorts dimensions and rejects a repeated axis", () => {
    const identity = kapFactIdentity(
      occurrence({
        measures: [
          { measureName: "ZAxis", measureValueName: "AMember" },
          { measureName: "CurrencyTypeAxis", measureValueName: "TotalMember" },
        ],
      }),
    );
    expect(identity.dimensions.map((d) => d.axis)).toEqual([
      "CurrencyTypeAxis",
      "ZAxis",
    ]);
    expect(
      code(() =>
        kapFactIdentity(
          occurrence({
            measures: [
              { measureName: "A", measureValueName: "X" },
              { measureName: "A", measureValueName: "Y" },
            ],
          }),
        ),
      ),
    ).toBe("duplicate_axis");
    expect(
      code(() =>
        kapFactIdentity(occurrence({ measures: [{ measureName: "A" }] })),
      ),
    ).toBe("invalid_dimension");
  });

  it("attributes typed-domain values to the enclosing concept", () => {
    const identity = kapFactIdentity(
      occurrence({
        itemName: "ClassesOfShares",
        parentName: "BasicEarningsLossPerShareFromDiscontinuedOperations",
        typedMember: true,
      }),
    );
    expect(identity.concept).toBe(
      "BasicEarningsLossPerShareFromDiscontinuedOperations",
    );
    expect(identity.dimensions).toEqual([
      { axis: "ClassesOfShares", member: null },
    ]);
  });

  it("collapses repeated presentations and reports conflicting ones", () => {
    const first = { occurrence: occurrence({ parentName: "A" }), value: "10" };
    const second = { occurrence: occurrence({ parentName: "B" }), value: "10" };
    const repeated = [first, second];
    expect(groupFactOccurrences(repeated)).toMatchObject({
      conflicts: [],
      facts: [{ occurrences: repeated }],
    });
    const conflicting = [first, { ...second, value: "11" }];
    const grouped = groupFactOccurrences(conflicting);
    expect(grouped.facts).toEqual([]);
    expect(grouped.conflicts).toHaveLength(1);
  });
});

describe("fiscal coverage", () => {
  const tspor = [
    ctx("2023-11-30", { instant: "2023-11-30" }),
    ctx("2023-05-31", { instant: "2023-05-31" }, "PREV"),
    ctx("2023-06-012023-11-30", {
      startDate: "2023-06-01",
      endDate: "2023-11-30",
    }),
    ctx(
      "2023-09-012023-11-30",
      { startDate: "2023-09-01", endDate: "2023-11-30" },
      "CURR3",
    ),
    ctx(
      "2022-06-012022-11-30",
      { startDate: "2022-06-01", endDate: "2022-11-30" },
      "PREV",
    ),
  ].map(normalizeKapContext);

  it("derives a June–May fiscal year from context dates", () => {
    expect(filingCoverage(tspor, "6 Months")).toEqual({
      reportingDate: "2023-11-30",
      fiscalYearStart: "2023-06-01",
      fiscalYearEnd: "2024-05-31",
      cumulativeMonths: 6,
    });
  });

  it("fails when KAP's period label disagrees with the dates", () => {
    expect(code(() => filingCoverage(tspor, "9 Months"))).toBe(
      "period_label_mismatch",
    );
    expect(code(() => filingCoverage(tspor, "Yıllık"))).toBe(
      "period_label_mismatch",
    );
  });

  it("rejects filings without a whole-month cumulative period", () => {
    const odd = [
      ctx("x", { startDate: "2023-06-15", endDate: "2023-11-30" }),
    ].map(normalizeKapContext);
    expect(code(() => filingCoverage(odd, null))).toBe("invalid_coverage");
    expect(code(() => filingCoverage([], null))).toBe("invalid_coverage");
  });

  it("finds the fiscal year containing a date", () => {
    expect(fiscalYearStartFor("2023-06-01", "2023-05-31")).toBe("2022-06-01");
    expect(fiscalYearStartFor("2023-06-01", "2025-07-15")).toBe("2025-06-01");
    expect(fiscalYearStartFor("2022-01-01", "2023-12-31")).toBe("2023-01-01");
  });
});

// ---------------------------------------------------------------------------
// Decision tables.

const NOMINAL: PurchasingPowerBasis = { kind: "nominal" };
const UNKNOWN: PurchasingPowerBasis = { kind: "unknown" };
const tms29 = (date: string): PurchasingPowerBasis => ({
  kind: "tms29",
  measuringUnitDate: date,
});

const basis = (overrides: Partial<SeriesBasis> = {}): SeriesBasis => ({
  issuerId: "issuer-1",
  scope: "consolidated",
  factKey: "Revenue||TRY",
  currency: "TRY",
  accountingBasis: "general",
  purchasingPower: NOMINAL,
  filingId: "f-9m",
  ...overrides,
});

describe("compatibility decision table", () => {
  it.each<[string, Partial<SeriesBasis>, string]>([
    ["same basis, another filing", { filingId: "f-h1" }, "compatible"],
    ["other issuer", { issuerId: "issuer-2" }, "entity_mismatch"],
    ["standalone vs consolidated", { scope: "standalone" }, "scope_mismatch"],
    [
      "other concept or member",
      { factKey: "Revenue|X=Y|TRY" },
      "concept_mismatch",
    ],
    ["other currency", { currency: "USD" }, "unit_mismatch"],
    [
      "bank vs general taxonomy",
      { accountingBasis: "banks" },
      "accounting_basis_mismatch",
    ],
    [
      "unknown basis, another filing",
      { filingId: "f-h1", purchasingPower: UNKNOWN },
      "purchasing_power_basis_unknown",
    ],
    [
      "nominal vs TMS 29",
      { filingId: "f-h1", purchasingPower: tms29("2024-06-30") },
      "purchasing_power_basis_mismatch",
    ],
    ["unknown basis, same filing", { purchasingPower: UNKNOWN }, "compatible"],
  ])("%s → %s", (_, overrides, expected) => {
    const result = checkCompatibility(basis(), basis(overrides));
    expect(result.compatible ? "compatible" : result.reason).toBe(expected);
  });

  it("requires one TMS 29 measuring unit across filings", () => {
    const a = basis({ purchasingPower: tms29("2024-06-30") });
    const b = basis({ filingId: "f-q1", purchasingPower: tms29("2024-03-31") });
    expect(checkCompatibility(a, b)).toEqual({
      compatible: false,
      reason: "measuring_unit_mismatch",
    });
    expect(
      checkCompatibility(a, { ...b, purchasingPower: tms29("2024-06-30") }),
    ).toEqual({ compatible: true });
  });

  it.each<
    [string, string, "none" | "tms29_applied" | "tms29_not_applied", string]
  >([
    ["2022-12-31", "2022-12-31", "none", "nominal"],
    ["2023-05-31", "2023-05-31", "tms29_not_applied", "nominal"],
    ["2022-12-31", "2022-12-31", "tms29_applied", "unknown"],
    ["2024-05-31", "2023-11-30", "none", "unknown"],
    ["2023-12-31", "2023-12-31", "tms29_applied", "tms29:2023-12-31"],
    ["2024-12-31", "2024-06-30", "tms29_not_applied", "nominal"],
  ])(
    "fiscal year end %s, report %s, evidence %s → %s",
    (fiscalYearEnd, reportingDate, evidence, expected) => {
      const result = purchasingPowerBasis({
        fiscalYearEnd,
        reportingDate,
        evidence: { kind: evidence },
      });
      expect(
        result.kind === "tms29"
          ? `tms29:${result.measuringUnitDate}`
          : result.kind,
      ).toBe(expected);
    },
  );
});

const obs = (
  start: string,
  end: string,
  overrides: Partial<SeriesBasis> = {},
): PeriodObservation => ({
  period: duration(start, end),
  basis: basis(overrides),
  ref: `${start}/${end}`,
});

const planKind = (plan: { kind: string; reason?: string }) =>
  plan.kind === "unavailable" ? plan.reason : plan.kind;

describe("standalone quarter decision table", () => {
  const q3 = { start: "2023-07-01", end: "2023-09-30" };
  it.each<
    [string, { start: string; end: string }, PeriodObservation[], string]
  >([
    [
      "reported three-month period (CURR3)",
      q3,
      [obs("2023-07-01", "2023-09-30"), obs("2023-01-01", "2023-09-30")],
      "direct",
    ],
    [
      "9M − H1 from two nominal filings",
      q3,
      [
        obs("2023-01-01", "2023-09-30"),
        obs("2023-01-01", "2023-06-30", { filingId: "f-h1" }),
      ],
      "difference",
    ],
    [
      "9M − H1 in different TMS 29 measuring units",
      q3,
      [
        obs("2023-01-01", "2023-09-30", {
          purchasingPower: tms29("2023-09-30"),
        }),
        obs("2023-01-01", "2023-06-30", {
          filingId: "f-h1",
          purchasingPower: tms29("2023-06-30"),
        }),
      ],
      "measuring_unit_mismatch",
    ],
    [
      "9M − H1 with an undetermined basis",
      q3,
      [
        obs("2023-01-01", "2023-09-30", { purchasingPower: UNKNOWN }),
        obs("2023-01-01", "2023-06-30", {
          filingId: "f-h1",
          purchasingPower: UNKNOWN,
        }),
      ],
      "purchasing_power_basis_unknown",
    ],
    [
      "9M consolidated − H1 standalone",
      q3,
      [
        obs("2023-01-01", "2023-09-30"),
        obs("2023-01-01", "2023-06-30", {
          filingId: "f-h1",
          scope: "standalone",
        }),
      ],
      "scope_mismatch",
    ],
    [
      "cumulative periods that do not share the fiscal start",
      q3,
      [obs("2023-01-01", "2023-09-30"), obs("2023-04-01", "2023-06-30")],
      "missing_period",
    ],
    ["no H1", q3, [obs("2023-01-01", "2023-09-30")], "missing_period"],
    [
      "Q1 only as a longer cumulative period",
      { start: "2023-01-01", end: "2023-03-31" },
      [obs("2023-01-01", "2023-06-30")],
      "missing_period",
    ],
    [
      "not a fiscal quarter",
      { start: "2023-02-01", end: "2023-04-30" },
      [],
      "fiscal_year_mismatch",
    ],
    [
      "not three whole months",
      { start: "2023-07-01", end: "2023-09-29" },
      [],
      "irregular_period",
    ],
  ])("%s → %s", (_, target, observations, expected) => {
    expect(
      planKind(planStandaloneQuarter(target, "2022-01-01", observations)),
    ).toBe(expected);
  });

  it("derives a June–May fiscal Q2 from 6M − 3M", () => {
    const plan = planStandaloneQuarter(
      { start: "2023-09-01", end: "2023-11-30" },
      "2023-06-01",
      [
        obs("2023-06-01", "2023-11-30"),
        obs("2023-06-01", "2023-08-31", { filingId: "f-q1" }),
      ],
    );
    expect(plan).toMatchObject({
      kind: "difference",
      minuend: { ref: "2023-06-01/2023-11-30" },
      subtrahend: { ref: "2023-06-01/2023-08-31" },
    });
  });

  it("requires one selected value per period", () => {
    expect(
      code(() =>
        planStandaloneQuarter(q3, "2022-01-01", [
          obs("2023-07-01", "2023-09-30"),
          obs("2023-07-01", "2023-09-30", { filingId: "f-other" }),
        ]),
      ),
    ).toBe("ambiguous_input");
  });
});

describe("trailing twelve months decision table", () => {
  const nineMonths = obs("2023-01-01", "2023-09-30");
  const fy2022 = obs("2022-01-01", "2022-12-31", { filingId: "f-fy22" });
  const nineMonths2022 = obs("2022-01-01", "2022-09-30", {
    filingId: "f-9m22",
  });
  const quarters = [
    obs("2022-10-01", "2022-12-31", { filingId: "f-fy22" }),
    obs("2023-01-01", "2023-03-31", { filingId: "f-q1" }),
    obs("2023-04-01", "2023-06-30", { filingId: "f-h1" }),
    obs("2023-07-01", "2023-09-30"),
  ];

  it.each<[string, string, PeriodObservation[], string]>([
    ["reported annual period", "2022-12-31", [fy2022], "direct"],
    [
      "9M + FY − prior 9M",
      "2023-09-30",
      [nineMonths, fy2022, nineMonths2022],
      "ytd_bridge",
    ],
    ["four reported quarters", "2023-09-30", quarters, "quarters"],
    [
      "prior year in another measuring unit",
      "2023-09-30",
      [
        nineMonths,
        {
          ...fy2022,
          basis: basis({
            filingId: "f-fy22",
            purchasingPower: tms29("2022-12-31"),
          }),
        },
        nineMonths2022,
      ],
      "purchasing_power_basis_mismatch",
    ],
    ["a quarter missing", "2023-09-30", quarters.slice(1), "missing_period"],
    ["not a month end", "2023-09-29", [], "irregular_period"],
  ])("%s → %s", (_, end, observations, expected) => {
    expect(
      planKind(planTrailingTwelveMonths(end, "2022-01-01", observations)),
    ).toBe(expected);
  });
});

describe("selection decision table", () => {
  // FY2022 revenue: first reported 2023-02-10, restated as a comparative in
  // the FY2023 filing, and once more in a later correction.
  const original: ReportedObservation = {
    filingId: "fy22",
    publishedAt: "2023-02-10T15:22:30Z",
    current: true,
    basis: NOMINAL,
    value: "100",
  };
  const comparative: ReportedObservation = {
    filingId: "fy23",
    publishedAt: "2024-03-01T15:00:00Z",
    current: false,
    basis: tms29("2023-12-31"),
    value: "180",
  };
  const correction: ReportedObservation = {
    filingId: "fy22-corr",
    publishedAt: "2023-04-01T10:00:00Z",
    current: true,
    basis: NOMINAL,
    value: "101",
  };
  const all = [comparative, original, correction];

  const selected = (result: ReturnType<typeof selectReportedValue>) =>
    result.status === "selected" ? result.observation.filingId : result.reason;

  it.each<
    [
      string,
      ReportedObservation[],
      Parameters<typeof selectReportedValue>[1],
      string,
    ]
  >([
    [
      "original",
      all,
      { policy: "as_originally_reported", asOf: "2026-01-01T00:00:00Z" },
      "fy22",
    ],
    [
      "latest, any known basis",
      all,
      { policy: "latest_compatible", asOf: "2026-01-01T00:00:00Z" },
      "fy23",
    ],
    [
      "latest nominal",
      all,
      {
        policy: "latest_compatible",
        asOf: "2026-01-01T00:00:00Z",
        basis: NOMINAL,
      },
      "fy22-corr",
    ],
    [
      "latest as known before the correction",
      all,
      { policy: "latest_compatible", asOf: "2023-03-01T00:00:00+03:00" },
      "fy22",
    ],
    [
      "before any publication",
      all,
      { policy: "latest_compatible", asOf: "2023-02-10T15:22:29Z" },
      "not_yet_published",
    ],
    [
      "only ever a comparative",
      [comparative],
      { policy: "as_originally_reported", asOf: "2026-01-01T00:00:00Z" },
      "no_original_report",
    ],
    [
      "unknown basis only",
      [{ ...comparative, basis: UNKNOWN }],
      { policy: "latest_compatible", asOf: "2026-01-01T00:00:00Z" },
      "no_compatible_basis",
    ],
    [
      "two filings at one instant disagree",
      [original, { ...original, filingId: "fy22-b", value: "99" }],
      { policy: "as_originally_reported", asOf: "2026-01-01T00:00:00Z" },
      "conflicting_values",
    ],
    [
      "nothing reported",
      [],
      { policy: "latest_compatible", asOf: "2026-01-01T00:00:00Z" },
      "not_reported",
    ],
  ])("%s → %s", (_, observations, options, expected) => {
    expect(selected(selectReportedValue(observations, options))).toBe(expected);
  });

  it("rejects times without an offset", () => {
    expect(
      code(() =>
        selectReportedValue([original], {
          policy: "latest_compatible",
          asOf: "2026-01-01 00:00:00",
        }),
      ),
    ).toBe("invalid_publication_time");
  });
});

// ---------------------------------------------------------------------------
// Real KAP evidence (02.01). Payloads are private and absent in CI.

const payloadDir = new URL("fixtures/kap/payloads/", import.meta.url);
const payloadsPresent = existsSync(payloadDir);

type Item = {
  name?: string;
  preferredLabel?: string;
  typedMember?: string;
  ReportItem?: Item | Item[];
  Values?: { Value?: RawValue | RawValue[] };
};
type RawValue = {
  contextId: string;
  currency: string;
  value: string;
  Measures?: { Measure?: object | object[] };
};
type Detail = {
  consolidation?: string;
  period?: { en?: string };
  time?: string;
  presentation?: {
    id: string;
    content: {
      ContextList?: { Context?: KapContext | KapContext[] };
      ReportItem?: Item | Item[];
    };
  }[];
};

const list = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

describe.skipIf(!payloadsPresent)(
  "KAP financial reports (local payloads)",
  () => {
    const manifest = JSON.parse(
      readFileSync(
        new URL("fixtures/kap/manifest.json", import.meta.url),
        "utf8",
      ),
    ) as { fixtures: { id: string; coverage: string[] }[] };
    // Loaded in beforeAll: a skipped describe still runs its body.
    const reports: { id: string; detail: Detail }[] = [];
    beforeAll(() => {
      for (const fixture of manifest.fixtures)
        if (fixture.coverage.includes("financial-report"))
          reports.push({
            id: fixture.id,
            detail: JSON.parse(
              readFileSync(new URL(`${fixture.id}.json`, payloadDir), "utf8"),
            ) as Detail,
          });
    });

    const facts = (detail: Detail) => {
      const items: {
        occurrence: KapFactOccurrence;
        value: string;
        subreport: string;
      }[] = [];
      for (const subreport of detail.presentation ?? []) {
        const contexts = new Map(
          list(subreport.content.ContextList?.Context)
            .map(normalizeKapContext)
            .map((context) => [context.sourceContextId, context]),
        );
        const walk = (
          nodes: Item | Item[] | undefined,
          parent: string | null,
        ) => {
          for (const node of list(nodes)) {
            for (const value of list(node.Values?.Value)) {
              const context = contexts.get(value.contextId);
              if (!context)
                throw new Error(`unknown context ${value.contextId}`);
              items.push({
                subreport: subreport.id,
                value: value.value,
                occurrence: {
                  itemName: node.name ?? "",
                  parentName: parent,
                  typedMember: node.typedMember === "yes",
                  preferredLabel: node.preferredLabel ?? null,
                  measures: list(value.Measures?.Measure),
                  context,
                  currency: value.currency,
                },
              });
            }
            walk(node.ReportItem, node.name ?? null);
          }
        };
        walk(subreport.content.ReportItem, null);
      }
      return items;
    };

    it("covers all 20 financial-report fixtures", () => {
      expect(reports).toHaveLength(20);
    });

    it("derives scope, publication time and fiscal coverage from every filing", () => {
      for (const { id, detail } of reports) {
        reportingScope(detail.consolidation);
        parseKapPublicationTime(detail.time);
        const contexts = (detail.presentation ?? []).flatMap((subreport) =>
          list(subreport.content.ContextList?.Context).map(normalizeKapContext),
        );
        if (id.endsWith("-bs-only")) {
          // A balance-sheet-only scope has no duration to anchor the fiscal year.
          expect(code(() => filingCoverage(contexts, null))).toBe(
            "invalid_coverage",
          );
          continue;
        }
        const coverage = filingCoverage(contexts, detail.period?.en ?? null);
        expect(coverage.fiscalYearStart.slice(5), id).toBe(
          id.includes("1230809") || id.startsWith("tspor") ? "06-01" : "01-01",
        );
      }
    });

    it("forms fact identities without conflicts and collapses repeated presentations", () => {
      let repeated = 0;
      for (const { id, detail } of reports) {
        const grouped = groupFactOccurrences(facts(detail));
        expect(
          grouped.conflicts.map((group) => group.key),
          id,
        ).toEqual([]);
        repeated += grouped.facts.filter(
          (group) => group.occurrences.length > 1,
        ).length;
      }
      // Insurance income statements present three technical balances twice.
      expect(repeated).toBeGreaterThan(0);
    });

    it("keeps closing and next opening balances apart when the source disagrees", () => {
      // MKK development snapshot, ISCTR 1110170: prior-years' profit closes
      // 2021 at 5414586000 but opens 2022 at 18882481000. Development data may
      // be test data, so this is shape evidence, not a claim about the real
      // filing. Either way both stay reported facts and 04.06 flags them.
      const disagreements: string[] = [];
      for (const { id, detail } of reports) {
        const byInstant = new Map<string, Set<string>>();
        for (const group of groupFactOccurrences(facts(detail)).facts) {
          if (group.identity.temporalRole === "context") continue;
          const key = factIdentityKey({
            ...group.identity,
            temporalRole: "context",
          });
          const values = byInstant.get(key) ?? new Set<string>();
          values.add(group.occurrences[0]?.value ?? "");
          byInstant.set(key, values);
        }
        for (const [key, values] of byInstant)
          if (values.size > 1) disagreements.push(`${id} ${key}`);
      }
      // Only these two development filings disagree in the evidence pack.
      expect(disagreements).toEqual(
        ["detail-1110170", "detail-1110914"].map(
          (id) =>
            `${id} Equity|i:2021-12-31|ComponentsOfEquityAxis=PriorYearsProfitsOrLossesMember|TRY`,
        ),
      );
    });

    it("reads TSPOR's cash-flow opening balance at the prior balance-sheet date", () => {
      const tspor = reports.find(
        (report) => report.id === "tspor-fr-2023-h1-cs",
      )!;
      const opening = groupFactOccurrences(facts(tspor.detail)).facts.find(
        (group) =>
          group.key ===
          "CashAndCashEquivalentsForCashFlowStatement|i:2023-05-31@period_start||TRY",
      );
      const balanceSheet = groupFactOccurrences(facts(tspor.detail)).facts.find(
        (group) => group.key === "CashAndCashEquivalents|i:2023-05-31||TRY",
      );
      expect(opening?.occurrences[0]?.value).toBe("13386194");
      expect(balanceSheet?.occurrences[0]?.value).toBe("13386194");
    });

    it("plans the reported CURR3 quarters directly", () => {
      const cases: [string, string, string][] = [
        ["tspor-fr-2023-h1-cs", "2023-09-01", "2023-11-30"],
        ["detail-1211850", "2023-07-01", "2023-09-30"],
      ];
      const plans = cases.map(([id, start, end]) => {
        const { detail } = reports.find((report) => report.id === id)!;
        const contexts = (detail.presentation ?? []).flatMap((subreport) =>
          list(subreport.content.ContextList?.Context).map(normalizeKapContext),
        );
        const coverage = filingCoverage(contexts, detail.period?.en ?? null);
        const durations = new Map(
          contexts.flatMap(({ sourceContextId, period }) =>
            period.kind === "duration"
              ? [
                  [
                    sourceContextId,
                    obs(period.start, period.end, { filingId: id }),
                  ] as const,
                ]
              : [],
          ),
        );
        return planKind(
          planStandaloneQuarter({ start, end }, coverage.fiscalYearStart, [
            ...durations.values(),
          ]),
        );
      });
      expect(plans).toEqual(["direct", "direct"]);
    });
  },
);
