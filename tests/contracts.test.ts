import { describe, expect, it } from "vitest";
import { API_VERSION, HealthResponseSchema } from "@finpill/contracts";

describe("v1 liveness contract", () => {
  it("round-trips the public payload through JSON", () => {
    const payload = { status: "ok", apiVersion: API_VERSION };
    expect(
      HealthResponseSchema.parse(JSON.parse(JSON.stringify(payload))),
    ).toEqual(payload);
  });

  it.each([
    {},
    { status: "ready", apiVersion: API_VERSION },
    { status: "ok", apiVersion: "v2" },
    { status: "ok", apiVersion: API_VERSION, secret: "must not be exposed" },
  ])("rejects invalid or undeclared fields: %j", (payload) => {
    expect(HealthResponseSchema.safeParse(payload).success).toBe(false);
  });
});
