import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    typedEnv: true,
    serverActions: {
      allowedOrigins: [process.env.BETTER_AUTH_URL as string],
    },
  },
};

export default nextConfig;
