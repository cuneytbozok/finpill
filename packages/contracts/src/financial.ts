import { z } from "zod";

/**
 * Financial period, scope, basis and unavailability contracts (A07). These are
 * transport shapes only; identity, compatibility and selection rules live in
 * the API (`apps/api/src/server/financial/`).
 */

function isCalendarDate(value: string): boolean {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** A calendar date, `YYYY-MM-DD`, with no time or time zone. */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarDate, "Invalid calendar date");

/** Dates come from the source context, never from a context key or label. */
export const FinancialPeriodSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("instant"), date: IsoDateSchema }),
  z
    .strictObject({
      kind: z.literal("duration"),
      start: IsoDateSchema,
      end: IsoDateSchema,
    })
    .refine(
      (period) => period.start <= period.end,
      "start must not follow end",
    ),
]);

export const ReportingScopeSchema = z.enum(["consolidated", "standalone"]);

/**
 * Purchasing-power basis. TMS 29 statements are expressed in the measuring
 * unit current at one date; values in different measuring units, or of an
 * unknown basis, are never combined.
 */
export const PurchasingPowerBasisSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("nominal") }),
  z.strictObject({
    kind: z.literal("tms29"),
    measuringUnitDate: IsoDateSchema,
  }),
  z.strictObject({ kind: z.literal("unknown") }),
]);

export const ValueSelectionPolicySchema = z.enum([
  "as_originally_reported",
  "latest_compatible",
]);

/** Reason codes for an explicit "no value" result; never a guessed number. */
export const FinancialUnavailableReasonSchema = z.enum([
  // missing
  "not_reported",
  "not_yet_published",
  "no_original_report",
  "missing_period",
  // incompatible
  "entity_mismatch",
  "scope_mismatch",
  "concept_mismatch",
  "unit_mismatch",
  "accounting_basis_mismatch",
  "purchasing_power_basis_unknown",
  "purchasing_power_basis_mismatch",
  "measuring_unit_mismatch",
  "fiscal_year_mismatch",
  "irregular_period",
  "period_outside_fiscal_year",
  "conflicting_values",
  "no_compatible_basis",
]);

/** Context carried by every financial value next to its `NumericValue`. */
export const FinancialValueContextSchema = z.strictObject({
  period: FinancialPeriodSchema,
  scope: ReportingScopeSchema,
  basis: PurchasingPowerBasisSchema,
  selection: ValueSelectionPolicySchema,
  /** Source publication time (UTC) of the selected filing, if any. */
  publishedAt: z.iso.datetime().nullable(),
});

export type IsoDate = z.infer<typeof IsoDateSchema>;
export type FinancialPeriod = z.infer<typeof FinancialPeriodSchema>;
export type ReportingScope = z.infer<typeof ReportingScopeSchema>;
export type PurchasingPowerBasis = z.infer<typeof PurchasingPowerBasisSchema>;
export type ValueSelectionPolicy = z.infer<typeof ValueSelectionPolicySchema>;
export type FinancialUnavailableReason = z.infer<
  typeof FinancialUnavailableReasonSchema
>;
export type FinancialValueContext = z.infer<typeof FinancialValueContextSchema>;
