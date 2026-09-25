import type {
  FinancialUnavailableReason,
  IsoDate,
  PurchasingPowerBasis,
  ReportingScope,
} from "@finpill/contracts";

/**
 * Everything that must match before two reported values may be combined
 * (subtracted into a quarter, added into TTM, placed in one series). A07.
 */
export type SeriesBasis = {
  issuerId: string;
  scope: ReportingScope;
  /** Fact concept plus canonical dimensions, e.g. `Revenue|` . */
  factKey: string;
  currency: string;
  /** Taxonomy family of the statement (`general`, `banks`, …). */
  accountingBasis: string;
  purchasingPower: PurchasingPowerBasis;
  /** The filing build the value was reported in. */
  filingId: string;
};

export type CompatibilityResult =
  | { compatible: true }
  | { compatible: false; reason: FinancialUnavailableReason };

const INCOMPATIBLE = (
  reason: FinancialUnavailableReason,
): CompatibilityResult => ({ compatible: false, reason });

export function purchasingPowerCompatible(
  a: PurchasingPowerBasis,
  b: PurchasingPowerBasis,
): CompatibilityResult {
  if (a.kind === "unknown" || b.kind === "unknown")
    return INCOMPATIBLE("purchasing_power_basis_unknown");
  if (a.kind !== b.kind) return INCOMPATIBLE("purchasing_power_basis_mismatch");
  if (
    a.kind === "tms29" &&
    b.kind === "tms29" &&
    a.measuringUnitDate !== b.measuringUnitDate
  )
    return INCOMPATIBLE("measuring_unit_mismatch");
  return { compatible: true };
}

/** Checks the first rule that fails, in a fixed, documented order. */
export function checkCompatibility(
  a: SeriesBasis,
  b: SeriesBasis,
): CompatibilityResult {
  if (a.issuerId !== b.issuerId) return INCOMPATIBLE("entity_mismatch");
  if (a.scope !== b.scope) return INCOMPATIBLE("scope_mismatch");
  if (a.factKey !== b.factKey) return INCOMPATIBLE("concept_mismatch");
  if (a.currency !== b.currency) return INCOMPATIBLE("unit_mismatch");
  if (a.accountingBasis !== b.accountingBasis)
    return INCOMPATIBLE("accounting_basis_mismatch");
  // One filing is internally consistent by construction, even when its basis
  // has not been established yet.
  if (a.filingId === b.filingId) return { compatible: true };
  return purchasingPowerCompatible(a.purchasingPower, b.purchasingPower);
}

export function checkAllCompatible(bases: SeriesBasis[]): CompatibilityResult {
  const [first, ...rest] = bases;
  if (!first) return { compatible: true };
  for (const other of rest) {
    const result = checkCompatibility(first, other);
    if (!result.compatible) return result;
  }
  return { compatible: true };
}

/** First annual reporting period that TMS 29 applies to (KGK, 2023-11-23). */
export const TMS29_FIRST_FISCAL_YEAR_END: IsoDate = "2023-12-31";

/**
 * Evidence about a filing's purchasing-power basis, recorded by 04.x or an
 * operator from the filing itself (statement notes, regulator exemptions).
 */
export type PurchasingPowerEvidence =
  { kind: "none" } | { kind: "tms29_applied" } | { kind: "tms29_not_applied" };

/**
 * A filing's basis. Fiscal years ending before 2023-12-31 predate TMS 29 in
 * Turkey and are nominal. Later filings need evidence: sector regulators
 * deferred application for some entities, so the date alone never decides.
 */
export function purchasingPowerBasis(input: {
  fiscalYearEnd: IsoDate;
  reportingDate: IsoDate;
  evidence: PurchasingPowerEvidence;
}): PurchasingPowerBasis {
  if (input.fiscalYearEnd < TMS29_FIRST_FISCAL_YEAR_END)
    // Evidence of TMS 29 before it applied contradicts the rule; leave it
    // unresolved for review rather than choose either side.
    return input.evidence.kind === "tms29_applied"
      ? { kind: "unknown" }
      : { kind: "nominal" };
  switch (input.evidence.kind) {
    case "tms29_applied":
      return { kind: "tms29", measuringUnitDate: input.reportingDate };
    case "tms29_not_applied":
      return { kind: "nominal" };
    case "none":
      return { kind: "unknown" };
  }
}
