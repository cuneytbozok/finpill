import { readServerEnvironment } from "./src/server/environment-schema";
import type { NextConfig } from "next";
readServerEnvironment(process.env);

const nextConfig: NextConfig = {
  transpilePackages: ["@finpill/contracts"],
};
export default nextConfig;
