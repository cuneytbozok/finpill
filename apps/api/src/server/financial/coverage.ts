import { checkAllCompatible } from "./compatibility";
import {
  FinancialContractError,
  addDays,
  addMonthsToMonthStart,
  wholeMonths,
} from "./identity";

import type {
  FinancialPeriod,
  FinancialUnavailableReason,
  IsoDate,
} from "@finpill/contracts";

import type { SeriesBasis } from "./compatibility";
import type { NormalizedContext } from "./identity";

/**
 * Fiscal coverage of a filing and period algebra for standalone quarters and
 * trailing twelve months (A07). Plans name their inputs; the arithmetic and
 * its lineage belong to the metric engine (05.x).
 */

export type FilingCoverage = {
  /** The latest date the filing reports (its balance-sheet date). */
  reportingDate: IsoDate;
  fiscalYearStart: IsoDate;
  fiscalYearEnd: IsoDate;
  /** Months from the fiscal-year start to the reporting date: 3, 6, 9 or 12. */
  cumulativeMonths: number;
};

const PERIOD_LABEL_MONTHS: Record<string, number> = {
  "3 Months": 3,
  "6 Months": 6,
  "9 Months": 9,
  Annual: 12,
};

/**
 * Derives coverage from actual context dates. The fiscal year starts where
 * the longest duration ending on the reporting date starts. KAP's `period`
 * label is only cross-checked; a disagreement fails instead of choosing one.
 */
export function filingCoverage(
  contexts: NormalizedContext[],
  periodLabelEn: string | null,
): FilingCoverage {
  const ends = contexts.map(({ period }) =>
    period.kind === "instant" ? period.date : period.end,
  );
  if (ends.length === 0)
    throw new FinancialContractError(
      "invalid_coverage",
      "Filing has no contexts",
    );
  const reportingDate = ends.reduce((a, b) => (a > b ? a : b));
  const current = contexts
    .map(({ period }) => period)
    .filter(
      (period): period is Extract<FinancialPeriod, { kind: "duration" }> =>
        period.kind === "duration" && period.end === reportingDate,
    )
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const fiscalYearStart = current[0]?.start;
  if (fiscalYearStart === undefined)
    throw new FinancialContractError(
      "invalid_coverage",
      "No duration ends on the reporting date",
    );
  const cumulativeMonths = wholeMonths(fiscalYearStart, reportingDate);
  if (cumulativeMonths === null || ![3, 6, 9, 12].includes(cumulativeMonths))
    throw new FinancialContractError(
      "invalid_coverage",
      "Cumulative period is not 3, 6, 9 or 12 whole months",
    );
  if (periodLabelEn !== null) {
    const labelled = PERIOD_LABEL_MONTHS[periodLabelEn];
    if (labelled === undefined || labelled !== cumulativeMonths)
      throw new FinancialContractError(
        "period_label_mismatch",
        "KAP period label disagrees with the context dates",
      );
  }
  return {
    reportingDate,
    fiscalYearStart,
    fiscalYearEnd: addDays(addMonthsToMonthStart(fiscalYearStart, 12), -1),
    cumulativeMonths,
  };
}

// ---------------------------------------------------------------------------
// Period plans.

/** A selected value for one period (selection runs first, see selection.ts). */
export type PeriodObservation = {
  period: Extract<FinancialPeriod, { kind: "duration" }>;
  basis: SeriesBasis;
  ref: string;
};

export type QuarterPlan =
  | { kind: "direct"; input: PeriodObservation }
  | {
      kind: "difference";
      minuend: PeriodObservation;
      subtrahend: PeriodObservation;
    }
  | { kind: "unavailable"; reason: FinancialUnavailableReason };

export type TtmPlan =
  | { kind: "direct"; input: PeriodObservation }
  | {
      kind: "ytd_bridge";
      add: [PeriodObservation, PeriodObservation];
      subtract: PeriodObservation;
    }
  | {
      kind: "quarters";
      quarters: Exclude<QuarterPlan, { kind: "unavailable" }>[];
    }
  | { kind: "unavailable"; reason: FinancialUnavailableReason };

function index(observations: PeriodObservation[]) {
  const byPeriod = new Map<string, PeriodObservation>();
  for (const observation of observations) {
    const key = `${observation.period.start}/${observation.period.end}`;
    if (byPeriod.has(key))
      throw new FinancialContractError(
        "ambiguous_input",
        "Select one value per period before planning",
      );
    byPeriod.set(key, observation);
  }
  return (start: IsoDate, end: IsoDate) => byPeriod.get(`${start}/${end}`);
}

/** Fiscal-year start of the fiscal year containing `date`. */
export function fiscalYearStartFor(
  fiscalYearStart: IsoDate,
  date: IsoDate,
): IsoDate {
  let start = fiscalYearStart;
  while (start > date) start = addMonthsToMonthStart(start, -12);
  while (addMonthsToMonthStart(start, 12) <= date)
    start = addMonthsToMonthStart(start, 12);
  return start;
}

const unavailable = (reason: FinancialUnavailableReason) =>
  ({ kind: "unavailable", reason }) as const;

/**
 * Standalone quarter: (A) a reported three-month period, else (B) the
 * difference of two cumulative periods from the same fiscal-year start whose
 * dates nest exactly. `fiscalYearStart` is any fiscal-year start of the
 * issuer's calendar; a quarter must lie inside one fiscal year.
 */
export function planStandaloneQuarter(
  target: { start: IsoDate; end: IsoDate },
  fiscalYearStart: IsoDate,
  observations: PeriodObservation[],
): QuarterPlan {
  if (wholeMonths(target.start, target.end) !== 3)
    return unavailable("irregular_period");
  const yearStart = fiscalYearStartFor(fiscalYearStart, target.start);
  if (target.end >= addMonthsToMonthStart(yearStart, 12))
    return unavailable("period_outside_fiscal_year");
  if ((wholeMonths(yearStart, target.end) ?? 0) % 3 !== 0)
    return unavailable("fiscal_year_mismatch");
  const find = index(observations);
  const direct = find(target.start, target.end);
  if (direct) return { kind: "direct", input: direct };
  if (target.start === yearStart) return unavailable("missing_period");
  const minuend = find(yearStart, target.end);
  const subtrahend = find(yearStart, addDays(target.start, -1));
  if (!minuend || !subtrahend) return unavailable("missing_period");
  const compatible = checkAllCompatible([minuend.basis, subtrahend.basis]);
  if (!compatible.compatible) return unavailable(compatible.reason);
  return { kind: "difference", minuend, subtrahend };
}

/**
 * Trailing twelve months ending on `end`: (a) a reported twelve-month period;
 * (b) current year-to-date + prior fiscal year − prior year-to-date; (c) four
 * contiguous standalone quarters. Every input must be mutually compatible.
 */
export function planTrailingTwelveMonths(
  end: IsoDate,
  fiscalYearStart: IsoDate,
  observations: PeriodObservation[],
): TtmPlan {
  const periodEnd = addDays(end, 1);
  if (!periodEnd.endsWith("-01")) return unavailable("irregular_period");
  const start = addMonthsToMonthStart(periodEnd, -12);
  const find = index(observations);
  const direct = find(start, end);
  if (direct) return { kind: "direct", input: direct };

  const reasons: FinancialUnavailableReason[] = [];
  const yearStart = fiscalYearStartFor(fiscalYearStart, end);
  const ytd = find(yearStart, end);
  const priorYear = find(
    addMonthsToMonthStart(yearStart, -12),
    addDays(yearStart, -1),
  );
  const priorYtd = find(
    addMonthsToMonthStart(yearStart, -12),
    addDays(addMonthsToMonthStart(periodEnd, -12), -1),
  );
  if (ytd && priorYear && priorYtd) {
    const compatible = checkAllCompatible([
      ytd.basis,
      priorYear.basis,
      priorYtd.basis,
    ]);
    if (compatible.compatible)
      return { kind: "ytd_bridge", add: [ytd, priorYear], subtract: priorYtd };
    reasons.push(compatible.reason);
  }

  const quarters: Exclude<QuarterPlan, { kind: "unavailable" }>[] = [];
  for (let i = 3; i >= 0; i -= 1) {
    const quarterStart = addMonthsToMonthStart(periodEnd, -3 * (i + 1));
    const quarterEnd = addDays(addMonthsToMonthStart(periodEnd, -3 * i), -1);
    const plan = planStandaloneQuarter(
      { start: quarterStart, end: quarterEnd },
      fiscalYearStart,
      observations,
    );
    if (plan.kind === "unavailable") {
      reasons.push(plan.reason);
      break;
    }
    quarters.push(plan);
  }
  if (quarters.length === 4) {
    const inputs = quarters.flatMap((plan) =>
      plan.kind === "direct" ? [plan.input] : [plan.minuend, plan.subtrahend],
    );
    const compatible = checkAllCompatible(inputs.map((input) => input.basis));
    if (compatible.compatible) return { kind: "quarters", quarters };
    reasons.push(compatible.reason);
  }
  // An incompatibility explains more than a missing input.
  return unavailable(
    reasons.find((reason) => reason !== "missing_period") ?? "missing_period",
  );
}
