import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, it } from "vitest";

const android = new URL("../apps/client/android/app/src/", import.meta.url);
const read = (path) => readFile(new URL(path, android), "utf8");

describe("Android local networking allowance", () => {
  it("keeps the shipped manifest free of cleartext settings", async () => {
    const manifest = await read("main/AndroidManifest.xml");
    assert.doesNotMatch(manifest, /usesCleartextTraffic|networkSecurityConfig/);
  });

  it("permits cleartext only to localhost, only in debug builds", async () => {
    const manifest = await read("debug/AndroidManifest.xml");
    assert.match(
      manifest,
      /android:networkSecurityConfig="@xml\/local_network_security_config"/,
    );
    const config = await read(
      "debug/res/xml/local_network_security_config.xml",
    );
    assert.match(config, /<base-config cleartextTrafficPermitted="false"/);
    const domains = [...config.matchAll(/<domain[^>]*>([^<]+)<\/domain>/g)];
    assert.deepEqual(
      domains.map(([, domain]) => domain),
      ["localhost"],
    );
    assert.match(config, /includeSubdomains="false"/);
  });
});
