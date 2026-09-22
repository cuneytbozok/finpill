import {
  PublicEnvironmentSchema,
  parseEnvironment,
} from "../../../packages/contracts/src/environment";

const publicKeys = new Set(Object.keys(PublicEnvironmentSchema.shape));

// Public metadata injected by Vercel's framework builder, not Finpill settings.
// Keep exact names: VERCEL_OIDC_TOKEN and arbitrary VERCEL_* values are not public.
// https://vercel.com/docs/environment-variables/framework-environment-variables
const platformPublicKeys = new Set([
  "NEXT_PUBLIC_VERCEL_ENV",
  "NEXT_PUBLIC_VERCEL_TARGET_ENV",
  "NEXT_PUBLIC_VERCEL_URL",
  "NEXT_PUBLIC_VERCEL_BRANCH_URL",
  "NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL",
  "NEXT_PUBLIC_VERCEL_REGION",
  "NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID",
  "NEXT_PUBLIC_VERCEL_PROJECT_ID",
  "NEXT_PUBLIC_VERCEL_HASH_SALT",
  "NEXT_PUBLIC_VERCEL_GIT_PROVIDER",
  "NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG",
  "NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER",
  "NEXT_PUBLIC_VERCEL_GIT_REPO_ID",
  "NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF",
  "NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA",
  "NEXT_PUBLIC_VERCEL_GIT_PREVIOUS_SHA",
  "NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE",
  "NEXT_PUBLIC_VERCEL_GIT_COMMIT_AUTHOR_LOGIN",
  "NEXT_PUBLIC_VERCEL_GIT_COMMIT_AUTHOR_NAME",
  "NEXT_PUBLIC_VERCEL_GIT_PULL_REQUEST_ID",
]);

export function validateClientEnvironment(env: NodeJS.ProcessEnv) {
  // Unknown public names could accidentally expose a privileged credential.
  const unknownKeys = Object.keys(env).filter(
    (key) =>
      key.startsWith("NEXT_PUBLIC_") &&
      !publicKeys.has(key) &&
      !platformPublicKeys.has(key),
  );
  if (unknownKeys.length > 0) {
    throw new Error(
      `Unrecognized NEXT_PUBLIC_ setting; use the public environment allowlist: ${unknownKeys.sort().join(", ")}`,
    );
  }
  const deploymentEnvironment =
    env.VERCEL === "1"
      ? (
          {
            production: "production",
            preview: "staging",
            development: "local",
          } as Record<string, string>
        )[env.VERCEL_ENV ?? ""]
      : undefined;
  return parseEnvironment(PublicEnvironmentSchema, {
    ...env,
    NEXT_PUBLIC_APP_ENV: env.NEXT_PUBLIC_APP_ENV ?? deploymentEnvironment,
  });
}
