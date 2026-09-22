import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));
const eslint = new ESLint({ cwd: root });
const client = path.join(root, "apps/client/src/probe.ts");
const contracts = path.join(root, "packages/contracts/src/probe.ts");

async function boundaryErrors(code, filePath = client) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter(
    (message) => message.ruleId === "finpill/browser-boundary",
  );
}

describe("browser/server import boundary", () => {
  it.each([
    'import "node:fs";',
    "void process.env.KAP_API_SECRET;",
    "const env = process.env;",
    'void process["env"];',
    'import "fs/promises";',
    'import "server-only";',
    'import "next/headers";',
    'export * from "../../api/src/server/health";',
    'void import("../../api/src/server/health");',
    'require("../../api/src/server/health");',
    'import "@/server/health";',
    '"use server"; export async function action() {}',
    "void import(moduleName);",
    'import type { HealthResponse } from "../../api/src/server/health";',
    'export type T = typeof import("next/headers");',
  ])("rejects forbidden imports or server actions: %s", async (source) => {
    expect(await boundaryErrors(source)).not.toHaveLength(0);
  });

  it("resolves a relative cross-application import", async () => {
    expect(
      await boundaryErrors('import "../../api/src/app/api/v1/health/route";'),
    ).not.toHaveLength(0);
  });

  it("prevents shared contracts from depending on an application", async () => {
    expect(
      await boundaryErrors(
        'import "../../../apps/client/src/app/page";',
        contracts,
      ),
    ).not.toHaveLength(0);
  });

  it("prevents browser code from importing build-time configuration", async () => {
    expect(await boundaryErrors('import "../next.config";')).not.toHaveLength(
      0,
    );
  });

  it("allows shared contracts and browser dependencies from the client", async () => {
    expect(
      await boundaryErrors('import "@finpill/contracts"; import "react";'),
    ).toHaveLength(0);
  });

  it("allows the contract schema dependency", async () => {
    expect(await boundaryErrors('import "zod";', contracts)).toHaveLength(0);
  });

  it("allows server dependencies in the API application", async () => {
    const filePath = path.join(root, "apps/api/src/server/probe.ts");
    expect(
      await boundaryErrors('import "node:fs"; import "server-only";', filePath),
    ).toHaveLength(0);
  });
});
