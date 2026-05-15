import type { NextConfig } from "next";
import { backendOriginFromEnv } from "./lib/backend-origin";

/** 환경변수 없으면 Railway 기본값 — 브라우저는 api.ts에서 /api-proxy 동일 출처로 호출 */
const backend = backendOriginFromEnv();

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api-proxy/:path*", destination: `${backend}/:path*` }];
  },
};

export default nextConfig;
