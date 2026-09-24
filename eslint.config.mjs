import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import { browserBoundary } from "./tools/eslint/browser-boundary.mjs";

export default [
  {
    ignores: [
      "**/.next/**",
      "**/out/**",
      "**/next-env.d.ts",
      "**/coverage/**",
      "**/build/**",
      "apps/client/ios/**",
      "apps/client/android/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin, "react-hooks": reactHooks },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,
    },
    settings: { next: { rootDir: ["apps/client", "apps/api"] } },
  },
  {
    files: [
      "apps/client/src/**/*.{ts,tsx,js,jsx}",
      "packages/contracts/src/**/*.{ts,tsx,js,jsx}",
    ],
    plugins: { finpill: { rules: { "browser-boundary": browserBoundary } } },
    rules: { "finpill/browser-boundary": "error" },
  },
];
