import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, it } from "vitest";

describe("static client deep links", () => {
  it("rewrites Vercel requests to the single static client entry", async () => {
    const config = JSON.parse(
      await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
    );
    assert.deepEqual(config.rewrites, [
      { source: "/(.*)", destination: "/index.html" },
    ]);
  });
});
