import { validateClientEnvironment } from "./config/environment";
import type { NextConfig } from "next";
validateClientEnvironment(process.env);

const nextConfig: NextConfig = {
  output: "export",
  transpilePackages: ["@finpill/contracts"],
};
export default nextConfig;
