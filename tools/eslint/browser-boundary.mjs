import { builtinModules } from "node:module";
import path from "node:path";
import ts from "typescript";

const builtins = new Set(
  builtinModules.map((name) => name.replace(/^node:/, "")),
);
const slash = (value) => value.split(path.sep).join("/");

export const browserBoundary = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Keep client and shared contracts independent of server code.",
    },
    schema: [],
    messages: {
      environment:
        "Read environment through the validated public configuration module.",
      server:
        "Server-only import '{{name}}' is forbidden in client/shared code.",
      outside: "Import '{{name}}' crosses the allowed workspace boundary.",
      computed:
        "Use a literal module path so the browser boundary can be verified.",
      directive:
        "Server actions are forbidden in the static client and shared contracts.",
    },
  },
  create(context) {
    const filename = path.resolve(context.filename);
    const normalized = slash(filename);
    const marker = normalized.includes("/apps/client/src/")
      ? "/apps/client/"
      : normalized.includes("/packages/contracts/src/")
        ? "/packages/contracts/"
        : undefined;
    if (!marker) return {};
    const root = normalized.slice(0, normalized.indexOf(marker));
    const ownRoot = root + marker;
    const contractsRoot = root + "/packages/contracts/";
    const configPath = path.join(ownRoot, "tsconfig.json");
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    const options = config.error
      ? {}
      : ts.parseJsonConfigFileContent(config.config, ts.sys, ownRoot).options;

    function check(node, source) {
      if (!source || typeof source.value !== "string") {
        context.report({ node, messageId: "computed" });
        return;
      }
      const name = source.value;
      const bare = name.replace(/^node:/, "");
      if (
        name.startsWith("node:") ||
        builtins.has(bare) ||
        /^(server-only|next\/(headers|server|cache))($|\/)/.test(name) ||
        /(^|\/)server(\/|$)|\.server(\.|$)/.test(name)
      ) {
        context.report({ node, messageId: "server", data: { name } });
        return;
      }
      const resolved = ts.resolveModuleName(
        name,
        filename,
        options,
        ts.sys,
      ).resolvedModule;
      if (!resolved) return; // TypeScript separately rejects unresolved imports.
      const target = slash(resolved.resolvedFileName);
      if (target.includes("/node_modules/") && !name.startsWith("@finpill/"))
        return;
      const allowed =
        target.startsWith(ownRoot + "src/") ||
        (marker === "/apps/client/" &&
          target.startsWith(contractsRoot + "src/"));
      if (!allowed || /\/server\/|\.server\./.test(target)) {
        context.report({ node, messageId: "outside", data: { name } });
      }
    }

    return {
      MemberExpression(node) {
        const object = node.object;
        if (
          object.type === "Identifier" &&
          object.name === "process" &&
          ((!node.computed && node.property.name === "env") || node.computed)
        ) {
          if (!normalized.endsWith("/apps/client/src/config/environment.ts"))
            context.report({ node, messageId: "environment" });
        }
      },
      ImportDeclaration(node) {
        check(node, node.source);
      },
      ExportNamedDeclaration(node) {
        if (node.source) check(node, node.source);
      },
      ExportAllDeclaration(node) {
        check(node, node.source);
      },
      ImportExpression(node) {
        check(node, node.source);
      },
      TSImportType(node) {
        check(node, node.source);
      },
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require"
        ) {
          check(node, node.arguments[0]);
        }
      },
      TSExternalModuleReference(node) {
        check(node, node.expression);
      },
      ExpressionStatement(node) {
        if (node.directive === "use server") {
          context.report({ node, messageId: "directive" });
        }
      },
    };
  },
};
