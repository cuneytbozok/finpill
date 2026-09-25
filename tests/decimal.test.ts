import { describe, expect, it } from "vitest";

import {
  DecimalError,
  DecimalStringSchema,
  NumericValueSchema,
  abs,
  add,
  compare,
  divide,
  isDecimalString,
  multiply,
  negate,
  parseDecimal,
  round,
  sign,
  subtract,
  toChartNumber,
} from "@finpill/contracts";

import type { DecimalString, RoundingMode } from "@finpill/contracts";

const d = (value: string) => parseDecimal(value);

function errorCode(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    if (error instanceof DecimalError) return error.code;
    throw error;
  }
  return undefined;
}

// Independent oracle: BigInt fixed-point at scale 40.
const SCALE = 40n;
function toBig(value: string): bigint {
  const negative = value.startsWith("-");
  const [whole = "0", fraction = ""] = value.replace("-", "").split(".");
  const big = BigInt(whole + fraction.padEnd(Number(SCALE), "0"));
  return negative ? -big : big;
}
function fromBig(value: bigint, scale = SCALE): string {
  const negative = value < 0n;
  const digits = (negative ? -value : value)
    .toString()
    .padStart(Number(scale) + 1, "0");
  const whole = digits.slice(0, digits.length - Number(scale));
  const fraction = digits
    .slice(digits.length - Number(scale))
    .replace(/0+$/, "");
  const text = whole + (fraction ? "." + fraction : "");
  return negative && text !== "0" ? "-" + text : text;
}

// Deterministic generator of in-range decimal strings.
function* samples(count: number): Generator<DecimalString> {
  let state = 0x2f6b_1d3an;
  const next = () => {
    state = (state * 6364136223846793005n + 1442695040888963407n) % 2n ** 64n;
    return state;
  };
  for (let i = 0; i < count; i += 1) {
    const whole = (next() % 10n ** BigInt(Number(next() % 16n))).toString();
    const fraction = (next() % 10n ** 9n).toString().padStart(9, "0");
    const negative = next() % 2n === 0n ? "-" : "";
    yield parseDecimal(`${negative}${whole}.${fraction}`);
  }
}

describe("decimal strings", () => {
  it("canonicalizes source tokens without rounding", () => {
    expect(d("253604600.868")).toBe("253604600.868");
    expect(d("0060024084000")).toBe("60024084000");
    expect(d("-0.000")).toBe("0");
    expect(d("+12.50")).toBe("12.5");
    expect(d("1.5e3")).toBe("1500");
    expect(d("15E-4")).toBe("0.0015");
    expect(d("12345678901234567890123456789")).toBe(
      "12345678901234567890123456789",
    );
    expect(d("-999999999999999999999999999999.999999999999999999")).toBe(
      "-999999999999999999999999999999.999999999999999999",
    );
  });

  it("rejects invalid tokens instead of repairing them", () => {
    for (const token of [
      "",
      " 1",
      "1 ",
      "1,5",
      "1.000,50",
      "%9,9",
      "-",
      ".5",
      "5.",
      "NaN",
      "Infinity",
      "0x10",
      "1e",
      "--1",
    ])
      expect(
        errorCode(() => parseDecimal(token)),
        token,
      ).toBe("invalid");
  });

  it("fails explicitly outside the supported range", () => {
    for (const token of [
      "1000000000000000000000000000000",
      "0.0000000000000000001",
      "1e30",
      "1e-19",
      "1e999999999",
    ])
      expect(
        errorCode(() => parseDecimal(token)),
        token,
      ).toBe("out_of_range");
  });

  it("accepts only canonical strings at transport boundaries", () => {
    expect(DecimalStringSchema.parse("-1.25")).toBe("-1.25");
    for (const value of ["1.50", "01", "-0", "1e3", "+1", 1.5, " 1"])
      expect(DecimalStringSchema.safeParse(value).success, String(value)).toBe(
        false,
      );
    expect(isDecimalString("0")).toBe(true);
  });

  it("types numeric DTOs with explicit unavailable states", () => {
    expect(
      NumericValueSchema.parse({
        status: "available",
        value: "1049330437",
        unit: { kind: "currency", currency: "TRY" },
      }),
    ).toMatchObject({ value: "1049330437" });
    expect(
      NumericValueSchema.safeParse({
        status: "available",
        value: 1049330437,
        unit: { kind: "currency", currency: "TRY" },
      }).success,
    ).toBe(false);
    expect(
      NumericValueSchema.parse({
        status: "incompatible",
        unit: { kind: "ratio" },
        reason: "restatement_basis_differs",
      }).status,
    ).toBe("incompatible");
    expect(
      NumericValueSchema.safeParse({
        status: "missing",
        value: "0",
        unit: { kind: "ratio" },
        reason: "not_reported",
      }).success,
    ).toBe(false);
  });
});

describe("exact arithmetic", () => {
  it("is exact where floating point is not", () => {
    expect(add(d("0.1"), d("0.2"))).toBe("0.3");
    expect(subtract(d("9007199254740993"), d("1"))).toBe("9007199254740992");
    expect(multiply(d("1582594000000"), d("1.5"))).toBe("2373891000000");
    expect(negate(d("-3"))).toBe("3");
    expect(negate(d("0"))).toBe("0");
    expect(abs(d("-60024084000"))).toBe("60024084000");
    expect(compare(d("-1"), d("0.5"))).toBe(-1);
    expect(sign(d("-0.1"))).toBe(-1);
  });

  it("matches an independent BigInt oracle", () => {
    const values = [...samples(400)];
    for (let i = 0; i + 1 < values.length; i += 2) {
      const a = values[i] as DecimalString;
      const b = values[i + 1] as DecimalString;
      expect(add(a, b)).toBe(fromBig(toBig(a) + toBig(b)));
      expect(subtract(a, b)).toBe(fromBig(toBig(a) - toBig(b)));
      expect(multiply(a, b)).toBe(fromBig(toBig(a) * toBig(b), SCALE * 2n));
      expect(compare(a, b)).toBe(
        toBig(a) < toBig(b) ? -1 : toBig(a) > toBig(b) ? 1 : 0,
      );
    }
  });

  it("fails on results outside the range rather than rounding", () => {
    const big = d("999999999999999999999999999999");
    expect(errorCode(() => add(big, d("1")))).toBe("out_of_range");
    expect(errorCode(() => multiply(big, d("10")))).toBe("out_of_range");
    expect(errorCode(() => multiply(d("0.000000001"), d("0.0000000001")))).toBe(
      "out_of_range",
    );
    expect(errorCode(() => add("1.50" as DecimalString, d("1")))).toBe(
      "invalid",
    );
  });
});

describe("rounding", () => {
  // value, scale, half_up, half_even, down, up, floor, ceil
  const table: [string, number, ...string[]][] = [
    ["2.5", 0, "3", "2", "2", "3", "2", "3"],
    ["-2.5", 0, "-3", "-2", "-2", "-3", "-3", "-2"],
    ["3.5", 0, "4", "4", "3", "4", "3", "4"],
    ["1.005", 2, "1.01", "1", "1", "1.01", "1", "1.01"],
    ["-1.2345", 3, "-1.235", "-1.234", "-1.234", "-1.235", "-1.235", "-1.234"],
    ["-0.4", 0, "0", "0", "0", "-1", "-1", "0"],
    ["7", 2, "7", "7", "7", "7", "7", "7"],
  ];
  const modes: RoundingMode[] = [
    "half_up",
    "half_even",
    "down",
    "up",
    "floor",
    "ceil",
  ];

  it("rounds once, explicitly, per mode", () => {
    for (const [value, scale, ...expected] of table)
      modes.forEach((mode, index) =>
        expect(round(d(value), scale, mode), `${value} ${mode}`).toBe(
          expected[index],
        ),
      );
  });

  it("divides with a single rounding from the exact remainder", () => {
    for (const [value, scale, ...expected] of table)
      modes.forEach((mode, index) => {
        // value = (value × 7) / 7, so the quotient rounds exactly like `round`.
        const numerator = multiply(d(value), d("7"));
        expect(
          divide(numerator, d("7"), scale, mode),
          `${value}×7/7 ${mode}`,
        ).toBe(expected[index]);
      });
    expect(divide(d("1"), d("3"), 18, "half_up")).toBe("0.333333333333333333");
    expect(divide(d("2"), d("3"), 4, "half_even")).toBe("0.6667");
    expect(divide(d("-2"), d("3"), 4, "down")).toBe("-0.6666");
    // A quotient just above a tie must not be rounded down as a tie.
    expect(divide(d("2.5000000001"), d("1"), 0, "half_even")).toBe("3");
    expect(divide(d("0.1734"), d("1"), 2, "half_up")).toBe("0.17");
    expect(errorCode(() => divide(d("1"), d("0"), 2, "half_up"))).toBe(
      "division_by_zero",
    );
    expect(errorCode(() => divide(d("1"), d("3"), 19, "half_up"))).toBe(
      "invalid",
    );
  });

  it("matches a BigInt oracle for half-up division", () => {
    const values = [...samples(200)];
    for (let i = 0; i + 1 < values.length; i += 2) {
      const a = values[i] as DecimalString;
      const b = values[i + 1] as DecimalString;
      if (b === "0") continue;
      const scale = 6n;
      const numerator = toBig(a) * 10n ** scale;
      const divisor = toBig(b);
      let quotient = numerator / divisor;
      const remainder = numerator - quotient * divisor;
      const twice = 2n * (remainder < 0n ? -remainder : remainder);
      if (twice >= (divisor < 0n ? -divisor : divisor))
        quotient += numerator < 0n !== divisor < 0n ? -1n : 1n;
      expect(divide(a, b, 6, "half_up"), `${a}/${b}`).toBe(
        fromBig(quotient, scale),
      );
    }
  });

  it("converts to a JS number only for charts", () => {
    expect(toChartNumber(d("1049330437.5"))).toBe(1049330437.5);
  });
});
