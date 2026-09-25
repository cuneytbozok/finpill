import {
  DecimalError,
  compare,
  roundScaled,
  sign as decimalSign,
} from "./decimal";

import type { DecimalString } from "./decimal";

/**
 * Presentation formatting (A06). Output depends only on this module, not on
 * the WebView's ICU data, so web, iOS and Android render identically.
 * Formatting returns new strings and never changes the authoritative value.
 * Rounding is half-up (ties away from zero) at the displayed digit.
 */
export type NumberLocale = "tr" | "en";

export interface FormatOptions {
  /** Fixed number of fraction digits, 0–18. */
  readonly fractionDigits?: number;
  /** "always" shows "+" for positive values; zero never carries a sign. */
  readonly sign?: "auto" | "always";
}

const NBSP = " ";

const separators: Record<NumberLocale, { decimal: string; group: string }> = {
  tr: { decimal: ",", group: "." },
  en: { decimal: ".", group: "," },
};

// Largest first. Turkish: bin, milyon, milyar, trilyon.
const compactUnits: Record<NumberLocale, readonly [number, string][]> = {
  tr: [
    [12, NBSP + "Tn"],
    [9, NBSP + "Mr"],
    [6, NBSP + "Mn"],
    [3, NBSP + "B"],
  ],
  en: [
    [12, "T"],
    [9, "B"],
    [6, "M"],
    [3, "K"],
  ],
};

const currencySymbols: Record<string, string> = {
  TRY: "₺",
  USD: "$",
  EUR: "€",
};

function currencyPrefix(currency: string): string {
  if (!/^[A-Z]{3}$/.test(currency))
    throw new DecimalError("invalid", "Invalid currency code");
  return currencySymbols[currency] ?? currency + NBSP;
}

function digitsOption(options: FormatOptions, fallback: number): number {
  return options.fractionDigits ?? fallback;
}

/** Groups and localizes an unsigned canonical value already rounded to `digits`. */
function localize(
  magnitude: DecimalString,
  digits: number,
  locale: NumberLocale,
): string {
  const [whole = "0", fraction = ""] = magnitude.split(".");
  const { decimal, group } = separators[locale];
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return digits === 0
    ? grouped
    : grouped + decimal + fraction.padEnd(digits, "0");
}

function signPrefix(rounded: DecimalString, options: FormatOptions): string {
  const direction = decimalSign(rounded);
  if (direction < 0) return "-";
  return direction > 0 && options.sign === "always" ? "+" : "";
}

function formatScaled(
  value: DecimalString,
  powerOfTen: number,
  digits: number,
  locale: NumberLocale,
  options: FormatOptions,
  wrap: (body: string) => string,
): string {
  const rounded = roundScaled(value, powerOfTen, digits, "half_up");
  const magnitude = (
    rounded.startsWith("-") ? rounded.slice(1) : rounded
  ) as DecimalString;
  return (
    signPrefix(rounded, options) + wrap(localize(magnitude, digits, locale))
  );
}

export function formatDecimal(
  value: DecimalString,
  locale: NumberLocale,
  options: FormatOptions = {},
): string {
  return formatScaled(
    value,
    0,
    digitsOption(options, 2),
    locale,
    options,
    (body) => body,
  );
}

export function formatInteger(
  value: DecimalString,
  locale: NumberLocale,
  options: Omit<FormatOptions, "fractionDigits"> = {},
): string {
  return formatScaled(value, 0, 0, locale, options, (body) => body);
}

export function formatCurrency(
  value: DecimalString,
  currency: string,
  locale: NumberLocale,
  options: FormatOptions = {},
): string {
  const prefix = currencyPrefix(currency);
  return formatScaled(
    value,
    0,
    digitsOption(options, 2),
    locale,
    options,
    (body) => prefix + body,
  );
}

/** `ratio` is a fraction: "0.1734" → "%17,34" (tr) / "17.34%" (en). */
export function formatPercent(
  ratio: DecimalString,
  locale: NumberLocale,
  options: FormatOptions = {},
): string {
  return formatScaled(
    ratio,
    2,
    digitsOption(options, 2),
    locale,
    options,
    (body) => (locale === "tr" ? "%" + body : body + "%"),
  );
}

export function formatMultiple(
  value: DecimalString,
  locale: NumberLocale,
  options: FormatOptions = {},
): string {
  return formatScaled(
    value,
    0,
    digitsOption(options, 2),
    locale,
    options,
    (body) => body + "x",
  );
}

/**
 * Picks the largest unit not above the value, then moves up while rounding
 * carries into the next unit ("999.999,999" → "1,00 Mn", not "1.000,00 B").
 */
function compact(
  value: DecimalString,
  locale: NumberLocale,
  options: FormatOptions,
  prefix: string,
): string {
  const digits = digitsOption(options, 2);
  const magnitude = (
    value.startsWith("-") ? value.slice(1) : value
  ) as DecimalString;
  const units: readonly [number, string][] = [...compactUnits[locale], [0, ""]];
  let index = units.findIndex(
    ([power]) =>
      compare(magnitude, ("1" + "0".repeat(power)) as DecimalString) >= 0,
  );
  if (index < 0) index = units.length - 1;
  while (
    index > 0 &&
    compare(
      roundScaled(magnitude, -(units[index]?.[0] ?? 0), digits, "half_up"),
      "1000" as DecimalString,
    ) >= 0
  )
    index -= 1;
  const [power, suffix] = units[index] ?? [0, ""];
  return formatScaled(
    value,
    -power,
    digits,
    locale,
    options,
    (body) => prefix + body + suffix,
  );
}

export function formatCompact(
  value: DecimalString,
  locale: NumberLocale,
  options: FormatOptions = {},
): string {
  return compact(value, locale, options, "");
}

export function formatCompactCurrency(
  value: DecimalString,
  currency: string,
  locale: NumberLocale,
  options: FormatOptions = {},
): string {
  return compact(value, locale, options, currencyPrefix(currency));
}
