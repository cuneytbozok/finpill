import { purchasingPowerCompatible } from "./compatibility";
import { FinancialContractError } from "./identity";

import type {
  FinancialUnavailableReason,
  PurchasingPowerBasis,
  ValueSelectionPolicy,
} from "@finpill/contracts";

/**
 * Selection of one reported value for a fact identity (issuer, scope, concept,
 * dimensions, period) across filings (A07). Every filing that reports the
 * identity is an observation: as its current period or as a comparative.
 */
export type ReportedObservation = {
  filingId: string;
  /** Source publication time, UTC ISO-8601; the knowledge time. */
  publishedAt: string;
  /** The period ends on the filing's reporting date (not a comparative). */
  current: boolean;
  basis: PurchasingPowerBasis;
  /** Raw source token; equal identities with unequal tokens conflict. */
  value: string;
};

export type Selection =
  | { status: "selected"; observation: ReportedObservation }
  | { status: "unavailable"; reason: FinancialUnavailableReason };

function instant(value: string): number {
  const time = Date.parse(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/.test(value) ||
    Number.isNaN(time)
  )
    throw new FinancialContractError(
      "invalid_publication_time",
      "Times must be ISO-8601 with an offset",
    );
  return time;
}

const byPublication = (a: ReportedObservation, b: ReportedObservation) =>
  instant(a.publishedAt) - instant(b.publishedAt) ||
  (a.filingId < b.filingId ? -1 : a.filingId > b.filingId ? 1 : 0);

function pick(
  candidates: ReportedObservation[],
  which: "earliest" | "latest",
): Selection {
  const sorted = [...candidates].sort(byPublication);
  const chosen = which === "earliest" ? sorted[0] : sorted.at(-1);
  if (!chosen) return { status: "unavailable", reason: "not_reported" };
  const tied = sorted.filter(
    (item) => instant(item.publishedAt) === instant(chosen.publishedAt),
  );
  if (new Set(tied.map((item) => item.value)).size > 1)
    return { status: "unavailable", reason: "conflicting_values" };
  return { status: "selected", observation: chosen };
}

/**
 * - `as_originally_reported`: the earliest publication that reported the
 *   period as its current period. Later corrections and comparatives never
 *   change it.
 * - `latest_compatible`: the latest publication, current or comparative, in
 *   the requested purchasing-power basis (any known basis when omitted).
 *
 * Only publications at or before `asOf` are known, so there is no look-ahead.
 */
export function selectReportedValue(
  observations: ReportedObservation[],
  options: {
    policy: ValueSelectionPolicy;
    asOf: string;
    basis?: PurchasingPowerBasis;
  },
): Selection {
  if (observations.length === 0)
    return { status: "unavailable", reason: "not_reported" };
  const asOf = instant(options.asOf);
  const known = observations.filter(
    (item) => instant(item.publishedAt) <= asOf,
  );
  if (known.length === 0)
    return { status: "unavailable", reason: "not_yet_published" };

  if (options.policy === "as_originally_reported") {
    const current = known.filter((item) => item.current);
    if (current.length === 0)
      return { status: "unavailable", reason: "no_original_report" };
    return pick(current, "earliest");
  }

  const requested = options.basis;
  const compatible = known.filter((item) =>
    requested
      ? purchasingPowerCompatible(item.basis, requested).compatible
      : item.basis.kind !== "unknown",
  );
  if (compatible.length === 0)
    return { status: "unavailable", reason: "no_compatible_basis" };
  return pick(compatible, "latest");
}
