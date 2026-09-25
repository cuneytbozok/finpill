import Decimal from "decimal.js";
import { z } from "zod";

/**
 * Exact decimal values (A06). An authoritative number is a canonical decimal
 * string: plain notation, no exponent, no leading or trailing zeros, no "-0".
 * Arithmetic is exact; the only rounding is an explicit `divide` or `round`
 * with a stated scale and mode. Nothing here converts through a JS number
 * except `toChartNumber`.
 */
export type DecimalString = string & { readonly __decimal: unique symbol };

/** Inputs and results outside these bounds fail; they are never rounded to fit. */
export const DECIMAL_LIMITS = {
  integerDigits: 30,
  fractionDigits: 18,
} as const;

export type RoundingMode =
  | "half_up" // ties away from zero, as PostgreSQL round(numeric)
  | "half_even"
  | "down" // toward zero
  | "up" // away from zero
  | "floor"
  | "ceil";

export type DecimalErrorCode = "invalid" | "out_of_range" | "division_by_zero";

export class DecimalError extends Error {
  readonly code: DecimalErrorCode;

  constructor(code: DecimalErrorCode, message: string) {
    super(message);
    this.name = "DecimalError";
    this.code = code;
  }
}

const CANONICAL = /^-?(0|[1-9]\d{0,29})(\.\d{0,17}[1-9])?$/;
const LEXICAL = /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/;

export function isDecimalString(value: unknown): value is DecimalString {
  return typeof value === "string" && CANONICAL.test(value) && value !== "-0";
}

/** Transport schema: authoritative amounts cross JSON boundaries only in canonical form. */
export const DecimalStringSchema = z
  .string()
  .refine(isDecimalString, { message: "Expected a canonical decimal string" })
  .transform((value) => value as DecimalString);

/**
 * Parses a decimal token (JSON number syntax, optional leading "+", leading
 * zeros allowed) into canonical form without rounding. Whitespace, locale
 * separators, NaN, Infinity and hexadecimal are invalid, not repaired.
 */
export function parseDecimal(input: string): DecimalString {
  const match = LEXICAL.exec(input);
  if (!match) throw new DecimalError("invalid", "Invalid decimal token");
  const [, sign, whole = "", fraction = "", exponent = "0"] = match;
  const digits = (whole + fraction).replace(/^0+/, "");
  if (digits === "") return "0" as DecimalString;
  // Position of the decimal point within `digits`, counted from the left.
  const exponentValue = Number(exponent);
  if (!Number.isSafeInteger(exponentValue) || Math.abs(exponentValue) > 1000)
    throw new DecimalError("out_of_range", "Decimal exponent out of range");
  const leadingZeros = (whole + fraction).length - digits.length;
  const point = whole.length - leadingZeros + exponentValue;
  let integerPart: string;
  let fractionPart: string;
  if (point <= 0) {
    integerPart = "0";
    fractionPart = "0".repeat(-point) + digits;
  } else if (point >= digits.length) {
    integerPart = digits + "0".repeat(point - digits.length);
    fractionPart = "";
  } else {
    integerPart = digits.slice(0, point);
    fractionPart = digits.slice(point);
  }
  fractionPart = fractionPart.replace(/0+$/, "");
  if (
    (integerPart !== "0" &&
      integerPart.length > DECIMAL_LIMITS.integerDigits) ||
    fractionPart.length > DECIMAL_LIMITS.fractionDigits
  )
    throw new DecimalError("out_of_range", "Decimal out of supported range");
  return ((sign === "-" ? "-" : "") +
    integerPart +
    (fractionPart ? "." + fractionPart : "")) as DecimalString;
}

// Precision covers exact add, subtract and multiply of any two in-range values
// (at most 48 significant digits each); results are range-checked afterwards.
const ExactDecimal = Decimal.clone({
  precision: 100,
  rounding: Decimal.ROUND_DOWN,
  toExpNeg: -9e15,
  toExpPos: 9e15,
});

function toDecimal(value: DecimalString): Decimal {
  if (!isDecimalString(value))
    throw new DecimalError("invalid", "Expected a canonical decimal string");
  return new ExactDecimal(value);
}

function fromDecimal(value: Decimal): DecimalString {
  if (!value.isFinite())
    throw new DecimalError("out_of_range", "Decimal result is not finite");
  return parseDecimal(value.toFixed());
}

const decimalModes: Record<RoundingMode, Decimal.Rounding> = {
  half_up: Decimal.ROUND_HALF_UP,
  half_even: Decimal.ROUND_HALF_EVEN,
  down: Decimal.ROUND_DOWN,
  up: Decimal.ROUND_UP,
  floor: Decimal.ROUND_FLOOR,
  ceil: Decimal.ROUND_CEIL,
};

function checkScale(scale: number): void {
  if (
    !Number.isInteger(scale) ||
    scale < 0 ||
    scale > DECIMAL_LIMITS.fractionDigits
  )
    throw new DecimalError("invalid", "Scale must be an integer from 0 to 18");
}

export function add(a: DecimalString, b: DecimalString): DecimalString {
  return fromDecimal(toDecimal(a).plus(toDecimal(b)));
}

export function subtract(a: DecimalString, b: DecimalString): DecimalString {
  return fromDecimal(toDecimal(a).minus(toDecimal(b)));
}

/** Exact product; fails if the exact result has more than 18 fraction digits. */
export function multiply(a: DecimalString, b: DecimalString): DecimalString {
  return fromDecimal(toDecimal(a).times(toDecimal(b)));
}

export function negate(a: DecimalString): DecimalString {
  return fromDecimal(toDecimal(a).negated());
}

export function abs(a: DecimalString): DecimalString {
  return fromDecimal(toDecimal(a).abs());
}

export function compare(a: DecimalString, b: DecimalString): -1 | 0 | 1 {
  return toDecimal(a).comparedTo(toDecimal(b)) as -1 | 0 | 1;
}

export function sign(a: DecimalString): -1 | 0 | 1 {
  return a === "0" ? 0 : a.startsWith("-") ? -1 : 1;
}

export function round(
  a: DecimalString,
  scale: number,
  mode: RoundingMode,
): DecimalString {
  checkScale(scale);
  return fromDecimal(toDecimal(a).toDecimalPlaces(scale, decimalModes[mode]));
}

/**
 * Quotient rounded once, directly from the exact remainder, to `scale`
 * fraction digits. There is no intermediate rounding.
 */
export function divide(
  a: DecimalString,
  b: DecimalString,
  scale: number,
  mode: RoundingMode,
): DecimalString {
  checkScale(scale);
  const divisor = toDecimal(b);
  if (divisor.isZero())
    throw new DecimalError("division_by_zero", "Division by zero");
  const dividend = toDecimal(a).times(new ExactDecimal(10).pow(scale));
  let quotient = dividend.dividedToIntegerBy(divisor);
  const remainder = dividend.minus(quotient.times(divisor));
  if (!remainder.isZero()) {
    const direction = dividend.isNegative() !== divisor.isNegative() ? -1 : 1;
    const half = remainder.abs().times(2).comparedTo(divisor.abs());
    const awayFromZero =
      mode === "up" ||
      (mode === "floor" && direction < 0) ||
      (mode === "ceil" && direction > 0) ||
      (mode === "half_up" && half >= 0) ||
      (mode === "half_even" &&
        (half > 0 || (half === 0 && !quotient.mod(2).isZero())));
    if (awayFromZero) quotient = quotient.plus(direction);
  }
  return fromDecimal(quotient.dividedBy(new ExactDecimal(10).pow(scale)));
}

/**
 * Approximation for chart geometry only. Labels, tooltips and drill-down use
 * the exact string.
 */
export function toChartNumber(a: DecimalString): number {
  return Number(toDecimal(a).toString());
}

/**
 * Rounds `a` × 10^`powerOfTen` once to `scale` fraction digits (percentages,
 * compact units). The shift itself is exact.
 */
export function roundScaled(
  a: DecimalString,
  powerOfTen: number,
  scale: number,
  mode: RoundingMode,
): DecimalString {
  checkScale(scale);
  if (!Number.isInteger(powerOfTen) || Math.abs(powerOfTen) > 100)
    throw new DecimalError("invalid", "Power of ten must be a small integer");
  return fromDecimal(
    toDecimal(a)
      .times(new ExactDecimal(10).pow(powerOfTen))
      .toDecimalPlaces(scale, decimalModes[mode]),
  );
}
