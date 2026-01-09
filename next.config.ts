import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    typedEnv: true,
    serverActions: {
      allowedOrigins: [new URL(process.env.BETTER_AUTH_URL as string).host],
    },
  },
};

export default nextConfig;
