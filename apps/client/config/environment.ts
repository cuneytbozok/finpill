import {
  PublicEnvironmentSchema,
  parseEnvironment,
} from "../../../packages/contracts/src/environment";

const publicKeys = new Set(Object.keys(PublicEnvironmentSchema.shape));

export function validateClientEnvironment(env: NodeJS.ProcessEnv) {
  // Unknown public names could accidentally expose a privileged credential.
  if (
    Object.keys(env).some(
      (key) => key.startsWith("NEXT_PUBLIC_") && !publicKeys.has(key),
    )
  ) {
    throw new Error(
      "Unrecognized NEXT_PUBLIC_ setting; use the public environment allowlist",
    );
  }
  return parseEnvironment(PublicEnvironmentSchema, env);
}
