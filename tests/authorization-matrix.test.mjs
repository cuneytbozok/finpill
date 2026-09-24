/* global Response, URL, Headers */
import { describe, expect, it } from "vitest";

import { runAuthorizationMatrix } from "../tools/authorization-matrix.mjs";

const api = "http://localhost:3001";
const db = "https://db.example.com";

// An in-memory model of the intended API/RLS behavior. `leak` breaks it.
function fakeServer({ eligible = { user_a: true }, leak = false } = {}) {
  const profiles = [{ user_id: "user_b", display_name: "B" }];
  const json = (status, body) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status });
  return async (input, init) => {
    const url = new URL(input);
    const auth = new Headers(init.headers).get("Authorization");
    const caller = auth === "Bearer token-a" ? "user_a" : null;
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (url.origin === api) {
      if (!caller) return json(401, { error: "unauthorized" });
      if (url.pathname === "/api/v1/session")
        return json(200, { userId: caller });
      if (!eligible[caller]) return json(403, { error: "ineligible" });
      const own = profiles.find((row) => row.user_id === caller);
      if (method === "GET") return json(200, { profile: own ?? null });
      if (method === "POST") {
        if (own) return json(409, { error: "profile_exists" });
        const row = { user_id: caller, display_name: body.displayName };
        profiles.push(row);
        return json(201, { profile: row });
      }
      own.display_name = body.displayName;
      return json(200, { profile: own });
    }
    if (!caller) return json(401, {});
    const table = url.pathname.split("/").pop();
    const filter = url.searchParams.get("user_id")?.replace("eq.", "");
    if (table === "pilot_eligibility")
      return method === "GET"
        ? json(
            200,
            eligible[caller] === undefined
              ? []
              : [{ user_id: caller, enabled: eligible[caller] }],
          )
        : json(403, {});
    if (
      method === "DELETE" ||
      (body?.user_id !== undefined && method === "PATCH")
    )
      return json(403, {});
    const visible = profiles.filter(
      (row) => leak || (row.user_id === caller && eligible[caller]),
    );
    if (method === "GET")
      return json(
        200,
        visible.filter((row) => !filter || row.user_id === filter),
      );
    if (method === "POST")
      return body.user_id === caller && eligible[caller]
        ? json(201, [body])
        : json(403, {});
    return json(
      200,
      visible.filter((row) => row.user_id === filter),
    );
  };
}

const run = (options, server) =>
  runAuthorizationMatrix({
    getToken: async () => "token-a",
    apiOrigin: api,
    supabaseUrl: db,
    publishableKey: "sb_publishable_fake",
    userId: "user_a",
    otherUserId: "user_b",
    eligible: true,
    fetch: server,
    ...options,
  });

describe("authorization matrix", () => {
  it("passes every check against correct behavior", async () => {
    const results = await run({}, fakeServer());
    expect(results.filter((result) => !result.pass)).toEqual([]);
    expect(results.length).toBeGreaterThan(15);
  });

  it("passes the ineligible matrix against correct behavior", async () => {
    const results = await run(
      { eligible: false },
      fakeServer({ eligible: { user_a: false } }),
    );
    expect(results.filter((result) => !result.pass)).toEqual([]);
  });

  it("fails when another account's row is visible", async () => {
    const failed = (await run({}, fakeServer({ leak: true })))
      .filter((result) => !result.pass)
      .map((result) => result.check);
    expect(failed).toContain("data: cannot read the other account's profile");
    expect(failed).toContain("data: profile read returns only own row");
  });

  it("never returns tokens or bodies", async () => {
    const results = await run({}, fakeServer());
    expect(JSON.stringify(results)).not.toContain("token-a");
    for (const result of results)
      expect(Object.keys(result).sort()).toEqual(["actual", "check", "pass"]);
  });
});
