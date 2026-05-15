/**
 * 빌드(next.config)·클라이언트(api 서버 분기)에서 공통으로 쓰는 백엔드 origin.
 */

export const DEFAULT_BACKEND_ORIGIN =
  "https://kospi-prediction-game-production.up.railway.app";

export function normalizeBackendOrigin(raw: string | undefined): string {
  let envUrl = (raw ?? "").trim().replace(/\/$/, "");
  if (!envUrl) {
    return DEFAULT_BACKEND_ORIGIN;
  }
  if (!/^https?:\/\//i.test(envUrl)) {
    envUrl = envUrl.includes("localhost") ? `http://${envUrl}` : `https://${envUrl}`;
  }
  return envUrl;
}

export function backendOriginFromEnv(): string {
  return normalizeBackendOrigin(
    process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL,
  );
}
