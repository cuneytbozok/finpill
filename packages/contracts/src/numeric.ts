import { z } from "zod";

import { DecimalStringSchema } from "./decimal";

/**
 * Unit of an authoritative number. Ratios are fractions (0.1734), formatted as
 * percentages only at presentation. Period, basis, methodology and lineage are
 * added by the financial contracts (02.05, 05.x) that compose this value.
 */
export const NumericUnitSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("currency"),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }),
  z.strictObject({ kind: z.literal("ratio") }),
  z.strictObject({ kind: z.literal("multiple") }),
  z.strictObject({ kind: z.literal("shares") }),
  z.strictObject({ kind: z.literal("pure") }),
]);

export const UnavailableNumericStatusSchema = z.enum([
  "missing",
  "incompatible",
  "not_meaningful",
  "not_applicable",
]);

/** A value, or an explicit reason there is none; never a guessed number. */
export const NumericValueSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("available"),
    value: DecimalStringSchema,
    unit: NumericUnitSchema,
  }),
  z.strictObject({
    status: UnavailableNumericStatusSchema,
    unit: NumericUnitSchema,
    reason: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  }),
]);

export type NumericUnit = z.infer<typeof NumericUnitSchema>;
export type NumericValue = z.infer<typeof NumericValueSchema>;
