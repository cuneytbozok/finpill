import { describe, expect, it } from "vitest";

import {
  JsonNumber,
  LosslessJsonError,
  parseLosslessJson,
} from "../apps/api/src/server/numbers/lossless-json";

describe("lossless JSON", () => {
  it("keeps every number token verbatim", () => {
    // Shapes from the 02.01 evidence: /memberSecurities capital and a detail Value.
    const parsed = parseLosslessJson(
      '[{"capital":253604600.868,"currentCapital":1.10},' +
        '{"value":"60024084000","rounding":"-3","big":12345678901234567890,' +
        '"exp":-1.5E+3,"text":"253604600.868","flag":true,"none":null}]',
    ) as Record<string, unknown>[];
    const [first, second] = parsed;
    expect(first?.capital).toBeInstanceOf(JsonNumber);
    expect((first?.capital as JsonNumber).source).toBe("253604600.868");
    expect((first?.currentCapital as JsonNumber).source).toBe("1.10");
    expect((first?.currentCapital as JsonNumber).toDecimal()).toBe("1.1");
    expect((second?.big as JsonNumber).toDecimal()).toBe(
      "12345678901234567890",
    );
    expect((second?.exp as JsonNumber).toDecimal()).toBe("-1500");
    // Strings stay strings; their meaning is decided by the parser (04.x).
    expect(second?.value).toBe("60024084000");
    expect(second?.text).toBe("253604600.868");
    expect(second?.flag).toBe(true);
    expect(second?.none).toBeNull();
  });

  it("keeps out-of-range tokens and fails only on conversion", () => {
    const value = parseLosslessJson("1e400") as JsonNumber;
    expect(value.source).toBe("1e400");
    expect(() => value.toDecimal()).toThrow(/range/);
  });

  it("rejects invalid JSON explicitly", () => {
    for (const text of ["", "{", "[1,]", "NaN", "01", "{'a':1}"])
      expect(() => parseLosslessJson(text), text).toThrow(LosslessJsonError);
  });
});
