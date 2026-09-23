import { describe, expect, it } from "vitest";
import { resolveDeepLink } from "../apps/client/src/runtime/deep-links";

const origin = "https://links.finpill.example";

describe("native link trust and routing", () => {
  it.each([
    ["/company/kuyas", "/company/KUYAS"],
    ["/company/kuyas/financials", "/company/KUYAS/financials"],
    ["/company/KUYAS/ratios", "/company/KUYAS/ratios"],
    ["/company/KUYAS/disclosures", "/company/KUYAS/disclosures"],
    ["/company/KUYAS/ai", "/company/KUYAS/ai"],
    ["/ai", "/search"],
  ])("routes a trusted company or compatibility link %s", (path, expected) => {
    expect(resolveDeepLink(`${origin}${path}`, origin)).toBe(expected);
  });

  it.each([
    "http://links.finpill.example/company/KUYAS",
    "https://evil.example/company/KUYAS",
    "https://links.finpill.example.evil.example/company/KUYAS",
    "https://links.finpill.example@evil.example/company/KUYAS",
    "javascript:alert(1)",
    "https://links.finpill.example/company/%2F",
    "https://links.finpill.example/company/KUYAS/unknown",
    "https://links.finpill.example/company/KUYAS?next=https://evil.example",
    "https://links.finpill.example/company/KUYAS#redirect",
    "not-a-url",
  ])("rejects an untrusted or malformed link %s", (url) => {
    expect(resolveDeepLink(url, origin)).toBeNull();
  });

  it("requires an explicitly configured origin", () => {
    expect(resolveDeepLink(`${origin}/company/KUYAS`, undefined)).toBeNull();
  });
});
