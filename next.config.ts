import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@earendil-works/pi-ai", "@prisma/client", "@prisma/adapter-pg", "pg", "sax"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/aida-public/**",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
