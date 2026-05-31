import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*"],
  serverExternalPackages: ["@earendil-works/pi-ai", "@prisma/client", "@prisma/adapter-pg", "pg", "sax", "@aws-sdk/client-s3"],
};

export default nextConfig;
