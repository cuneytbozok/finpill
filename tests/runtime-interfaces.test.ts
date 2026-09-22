import { describe, expect, it } from "vitest";
import {
  API_VERSION,
  ApiTransportError,
  HealthResponseSchema,
  companyRoute,
  createApiTransport,
  parseAppRoute,
  routePath,
} from "@finpill/contracts";

describe("shared route registry", () => {
  it.each([
    ["/", { kind: "home" }],
    ["/search", { kind: "search" }],
    ["/watchlist", { kind: "watchlist" }],
    ["/ai", { kind: "ai" }],
    ["/settings", { kind: "settings" }],
    [
      "/company/kuyas",
      { kind: "company", ticker: "KUYAS", section: "overview" },
    ],
    [
      "/company/kuyas/financials",
      { kind: "company", ticker: "KUYAS", section: "financials" },
    ],
    [
      "/company/ku-yas/disclosures",
      { kind: "company", ticker: "KU-YAS", section: "disclosures" },
    ],
  ])("parses canonical path %s", (pathname, expected) => {
    expect(parseAppRoute(pathname)).toEqual(expected);
  });

  it("supports arbitrary valid tickers without build-time enumeration", () => {
    const path = companyRoute("xyz.123", "ratios");
    expect(path).toBe("/company/XYZ.123/ratios");
    expect(parseAppRoute(path)).toEqual({
      kind: "company",
      ticker: "XYZ.123",
      section: "ratios",
    });
  });

  it.each([
    "company/KUYAS",
    "/company/%2F",
    "/company/KUYAS/unknown",
    "/unknown",
  ])("rejects a non-canonical path %s", (pathname) => {
    expect(parseAppRoute(pathname).kind).toBe("not-found");
  });

  it("builds canonical paths from route objects", () => {
    expect(routePath({ kind: "company", ticker: "KUYAS", section: "ai" })).toBe(
      "/company/KUYAS/ai",
    );
  });
});

describe("API transport", () => {
  const auth = { getAccessToken: async () => "test-token" };

  it("centralizes versioned requests and bearer token acquisition", async () => {
    let request: Request | undefined;
    const transport = createApiTransport({
      origin: "https://api.example.test",
      auth,
      fetch: async (input, init) => {
        request = new Request(input, init);
        return Response.json({ status: "ok", apiVersion: API_VERSION });
      },
    });

    await expect(
      transport.request({
        path: "/api/v1/health",
        response: HealthResponseSchema,
      }),
    ).resolves.toEqual({ status: "ok", apiVersion: API_VERSION });
    expect(request?.url).toBe("https://api.example.test/api/v1/health");
    expect(request?.headers.get("authorization")).toBe("Bearer test-token");
    expect(request?.headers.get("accept")).toBe("application/json");
  });

  it("rejects network failures, invalid bodies, and non-v1 paths", async () => {
    const offline = createApiTransport({
      origin: "https://api.example.test",
      auth,
      fetch: async () => Promise.reject(new Error("offline")),
    });
    await expect(
      offline.request({
        path: "/api/v1/health",
        response: HealthResponseSchema,
      }),
    ).rejects.toBeInstanceOf(ApiTransportError);

    const malformed = createApiTransport({
      origin: "https://api.example.test",
      auth,
      fetch: async () => Response.json({ status: "ok", apiVersion: "v2" }),
    });
    await expect(
      malformed.request({
        path: "/api/v1/health",
        response: HealthResponseSchema,
      }),
    ).rejects.toThrow("invalid response");
    await expect(
      malformed.request({
        path: "/api/v2/health",
        response: HealthResponseSchema,
      }),
    ).rejects.toThrow("Invalid API request path");
  });
});
