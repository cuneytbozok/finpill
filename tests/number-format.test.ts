import { describe, expect, it } from "vitest";

import {
  formatCompact,
  formatCompactCurrency,
  formatCurrency,
  formatDecimal,
  formatInteger,
  formatMultiple,
  formatPercent,
  parseDecimal,
} from "@finpill/contracts";

import type { DecimalString, NumberLocale } from "@finpill/contracts";

const d = (value: string) => parseDecimal(value);
const intlLocale: Record<NumberLocale, string> = { tr: "tr-TR", en: "en-US" };

describe("number formatting", () => {
  it("formats the blueprint and KAP evidence examples", () => {
    // Blueprint §23.8 examples.
    expect(formatCompactCurrency(d("1049330437"), "TRY", "tr")).toBe(
      "₺1,05 Mr",
    );
    expect(formatCompactCurrency(d("1049330437"), "TRY", "en")).toBe("₺1.05B");
    expect(formatPercent(d("0.1734"), "tr")).toBe("%17,34");
    expect(formatPercent(d("0.1734"), "en")).toBe("17.34%");
    expect(formatMultiple(d("3.284"), "tr")).toBe("3,28x");
    expect(formatMultiple(d("3.284"), "en")).toBe("3.28x");
    // 02.01 evidence: values are in full units; the PDFs show thousands/millions.
    expect(formatInteger(d("60024084000"), "tr")).toBe("60.024.084.000");
    expect(formatCompactCurrency(d("1582594000000"), "TRY", "tr")).toBe(
      "₺1,58 Tn",
    );
    expect(formatDecimal(d("253604600.868"), "tr", { fractionDigits: 3 })).toBe(
      "253.604.600,868",
    );
  });

  it("handles sign, zero and rounding carry", () => {
    expect(formatCurrency(d("-1049330437"), "TRY", "tr")).toBe(
      "-₺1.049.330.437,00",
    );
    expect(formatPercent(d("-0.1734"), "tr")).toBe("-%17,34");
    expect(formatPercent(d("0.15"), "en", { sign: "always" })).toBe("+15.00%");
    expect(formatPercent(d("-0.00001"), "tr", { sign: "always" })).toBe(
      "%0,00",
    );
    expect(formatDecimal(d("-0.004"), "en")).toBe("0.00");
    expect(formatDecimal(d("2.005"), "en")).toBe("2.01");
    expect(formatDecimal(d("-2.005"), "en")).toBe("-2.01");
    expect(formatCompact(d("999999.999"), "tr")).toBe("1,00 Mn");
    expect(formatCompact(d("999.999"), "en")).toBe("1.00K");
    expect(formatCompact(d("950"), "en", { fractionDigits: 0 })).toBe("950");
    expect(formatCompact(d("2500000000000000"), "en")).toBe("2,500.00T");
    expect(formatCurrency(d("12.5"), "GBP", "en")).toBe("GBP 12.50");
  });

  it("formats values beyond float precision exactly", () => {
    expect(formatInteger(d("12345678901234567890123456789"), "en")).toBe(
      "12,345,678,901,234,567,890,123,456,789",
    );
    expect(
      formatDecimal(d("0.123456789012345678"), "tr", { fractionDigits: 18 }),
    ).toBe("0,123456789012345678");
  });

  it("does not mutate the authoritative value", () => {
    const value = d("1049330437.555");
    const dto = Object.freeze({ value });
    formatCompactCurrency(dto.value, "TRY", "tr");
    formatPercent(dto.value, "en");
    expect(dto.value).toBe("1049330437.555");
  });

  it("rejects invalid options", () => {
    expect(() => formatDecimal(d("1"), "tr", { fractionDigits: 19 })).toThrow();
    expect(() => formatCurrency(d("1"), "try", "tr")).toThrow();
    expect(() => formatDecimal("1.50" as DecimalString, "tr")).toThrow();
  });

  // Independent oracle: ICU in Node, for values a double represents exactly
  // (ties are avoided because Intl rounds the binary value). Product output
  // does not depend on the device's ICU.
  it("agrees with Intl for exactly representable values", () => {
    const values = [
      "0",
      "7",
      "-7",
      "1234.5",
      "-1234.25",
      "1049330437",
      "999",
      "1000",
      "123456789.125",
      "-60024084000",
      "0.0625",
    ];
    for (const locale of ["tr", "en"] as const) {
      const intl = intlLocale[locale];
      for (const text of values) {
        const value = d(text);
        const number = Number(text);
        expect(formatDecimal(value, locale), `${locale} ${text}`).toBe(
          new Intl.NumberFormat(intl, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(number),
        );
        expect(formatInteger(value, locale)).toBe(
          new Intl.NumberFormat(intl, { maximumFractionDigits: 0 }).format(
            number,
          ),
        );
        expect(formatCurrency(value, "TRY", locale)).toBe(
          new Intl.NumberFormat(intl, {
            style: "currency",
            currency: "TRY",
            currencyDisplay: "narrowSymbol",
          }).format(number),
        );
        expect(formatPercent(value, locale)).toBe(
          new Intl.NumberFormat(intl, {
            style: "percent",
            minimumFractionDigits: 2,
          }).format(number),
        );
        expect(formatCompact(value, locale)).toBe(
          new Intl.NumberFormat(intl, {
            notation: "compact",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(number),
        );
      }
    }
  });
});
