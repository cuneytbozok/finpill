import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "export",
  transpilePackages: ["@finpill/contracts"],
};
export default nextConfig;
