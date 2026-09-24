import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { describe, expect, it } from "vitest";

const workflows = fileURLToPath(
  new URL("../.github/workflows/", import.meta.url),
);
const files = (await readdir(workflows)).filter((name) =>
  /\.ya?ml$/.test(name),
);
const sources = await Promise.all(
  files.map(async (name) => [
    name,
    await readFile(path.join(workflows, name), "utf8"),
  ]),
);

// CI must not be able to reach Production: it receives no repository secrets
// or variables, names no hosted project and only builds credential-free output.
describe("CI isolation from Production", () => {
  it("has workflows to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });
  it.each(sources)("%s receives no secrets or hosted targets", (_, source) => {
    expect(source).not.toMatch(/\$\{\{\s*(?:secrets|vars)\./);
    expect(source).not.toMatch(/secrets:\s*inherit/);
    expect(source).not.toMatch(
      /supabase\.co|clerk\.accounts\.dev|sk_live_|pk_live_|sb_secret_/i,
    );
    expect(source).toMatch(/permissions:\s*\n\s*contents:\s*read/);
  });
  it.each(sources)(
    "%s uses only Local or integration-free settings",
    (_, source) => {
      for (const [, value] of source.matchAll(/\bAPP_ENV:\s*(\S+)/g))
        expect(value).toBe("local");
      for (const [, value] of source.matchAll(
        /\b(?:AUTH_ENABLED|DATABASE_ENABLED|PRIVILEGED_DATA_ENABLED|KAP_ENABLED|NEXT_PUBLIC_API_ENABLED|NEXT_PUBLIC_AUTH_ENABLED):\s*(\S+)/g,
      ))
        expect(value).toBe('"false"');
    },
  );
});
