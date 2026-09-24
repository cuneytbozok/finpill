import { validateClientEnvironment } from "./config/environment";
import type { NextConfig } from "next";
const publicEnvironment = validateClientEnvironment(process.env);

const nextConfig: NextConfig = {
  output: "export",
  // Only this validated public value is synthesized from deployment metadata.
  // A Preview build has no application environment, so nothing is inlined.
  env: publicEnvironment.NEXT_PUBLIC_APP_ENV
    ? { NEXT_PUBLIC_APP_ENV: publicEnvironment.NEXT_PUBLIC_APP_ENV }
    : {},
  transpilePackages: ["@finpill/contracts"],
};
export default nextConfig;
