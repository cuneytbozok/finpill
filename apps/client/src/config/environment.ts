import { PublicEnvironmentSchema, parseEnvironment } from "@finpill/contracts";

// Keep literal references: Next replaces these at build time, including native assets.
export const publicEnvironment = parseEnvironment(PublicEnvironmentSchema, {
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_API_ENABLED: process.env.NEXT_PUBLIC_API_ENABLED,
  NEXT_PUBLIC_API_ORIGIN: process.env.NEXT_PUBLIC_API_ORIGIN,
  NEXT_PUBLIC_AUTH_ENABLED: process.env.NEXT_PUBLIC_AUTH_ENABLED,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_DEEP_LINK_ORIGIN: process.env.NEXT_PUBLIC_DEEP_LINK_ORIGIN,
});
