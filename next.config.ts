import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/interview",
  experimental: {
    // 增大请求体大小限制（默认 10MB，录音文件可能超过）
    proxyClientMaxBodySize: "200mb",
  },
};

export default nextConfig;
