import {
  getExpertChatEligibility,
  getMe,
  type ExpertChatEligibility,
  type UserProfile,
} from "@/lib/api";

const ME_TTL_MS = 90_000;
const ELIG_TTL_MS = 120_000;

let meCache: { token: string; data: UserProfile; savedAt: number } | null = null;
let meInflight: { token: string; promise: Promise<UserProfile> } | null = null;

const eligCache = new Map<string, { data: ExpertChatEligibility; savedAt: number }>();
const eligInflight = new Map<string, Promise<ExpertChatEligibility>>();

function eligKey(token: string, surveyDate?: string): string {
  const d = surveyDate?.trim().slice(0, 10) ?? "";
  return `${token}|${d}`;
}

/** 탭·페이지마다 /api/me 반복 호출 방지 (HAR: 14회 → 1~2회) */
export async function getMeCached(token: string): Promise<UserProfile> {
  const now = Date.now();
  if (meCache && meCache.token === token && now - meCache.savedAt < ME_TTL_MS) {
    return meCache.data;
  }
  if (meInflight?.token === token) {
    return meInflight.promise;
  }
  const promise = getMe(token).then((data) => {
    meCache = { token, data, savedAt: Date.now() };
    meInflight = null;
    return data;
  });
  meInflight = { token, promise };
  promise.catch(() => {
    if (meInflight?.token === token) meInflight = null;
  });
  return promise;
}

/** 하단 탭 고수 잠금 — AppTabNav 등 공통 (HAR: eligibility 22회 → 캐시 1회) */
export async function getExpertChatEligibilityCached(
  token: string,
  surveyDate?: string,
): Promise<ExpertChatEligibility> {
  const key = eligKey(token, surveyDate);
  const now = Date.now();
  const hit = eligCache.get(key);
  if (hit && now - hit.savedAt < ELIG_TTL_MS) {
    return hit.data;
  }
  const inflight = eligInflight.get(key);
  if (inflight) return inflight;

  const promise = getExpertChatEligibility(token, surveyDate).then((data) => {
    eligCache.set(key, { data, savedAt: Date.now() });
    eligInflight.delete(key);
    return data;
  });
  eligInflight.set(key, promise);
  promise.catch(() => {
    eligInflight.delete(key);
  });
  return promise;
}

export function invalidateMeCache(): void {
  meCache = null;
  meInflight = null;
}

export function invalidateExpertEligibilityCache(): void {
  eligCache.clear();
  eligInflight.clear();
}

export function clearSessionApiCache(): void {
  invalidateMeCache();
  invalidateExpertEligibilityCache();
}
