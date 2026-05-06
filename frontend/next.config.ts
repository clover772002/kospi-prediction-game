import type { NextConfig } from "next";

/** 리라이트·서버 측 보정용 백엔드 origin (로컬 예전 이름 NEXT_PUBLIC_API_URL 호환) */
function pickBackendOrigin(): string {
  return (
    (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "")
      .trim()
      .replace(/\/$/, "")
  );
}

const backend = pickBackendOrigin();

const nextConfig: NextConfig = {
  async rewrites() {
    if (!backend) return [];
    return [{ source: "/api-proxy/:path*", destination: `${backend}/:path*` }];
  },
};

export default nextConfig;
