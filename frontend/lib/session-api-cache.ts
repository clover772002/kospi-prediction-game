import {
  getDirectionChatRoom,
  getExpertChatEligibility,
  getExpertChatThreads,
  getMe,
  getMySurveyResponse,
  getPendingGrant,
  getTodaySummary,
  type DirectionChatRoom,
  type ExpertChatEligibility,
  type ExpertChatThreadSummary,
  type MySurveyResponse,
  type NextSurveyInfo,
  type TodaySurvey,
  type UserProfile,
} from "@/lib/api";

const ME_TTL_MS = 90_000;
const ELIG_TTL_MS = 120_000;
const MY_RESP_TTL_MS = 90_000;
const PENDING_GRANT_TTL_MS = 60_000;
const NEXT_SURVEY_TTL_MS = 120_000;
const TODAY_SUMMARY_TTL_MS = 90_000;
const DIRECTION_ROOM_TTL_MS = 45_000;
const EXPERT_THREADS_TTL_MS = 45_000;

let meCache: { token: string; data: UserProfile; savedAt: number } | null = null;
let meInflight: { token: string; promise: Promise<UserProfile> } | null = null;

const eligCache = new Map<string, { data: ExpertChatEligibility; savedAt: number }>();
const eligInflight = new Map<string, Promise<ExpertChatEligibility>>();

const myRespCache = new Map<string, { data: MySurveyResponse; savedAt: number }>();
const myRespInflight = new Map<string, Promise<MySurveyResponse>>();

const pendingGrantCache = new Map<string, { grantKind: string | null; savedAt: number }>();
const pendingGrantInflight = new Map<string, Promise<string | null>>();

let nextSurveyCache: { data: NextSurveyInfo | null; savedAt: number } | null = null;
let nextSurveyInflight: Promise<NextSurveyInfo | null> | null = null;

let todaySummaryCache: { data: TodaySurvey; savedAt: number } | null = null;
let todaySummaryInflight: Promise<TodaySurvey> | null = null;

const directionRoomCache = new Map<string, { data: DirectionChatRoom; savedAt: number }>();
const directionRoomInflight = new Map<string, Promise<DirectionChatRoom>>();

const expertThreadsCache = new Map<string, { data: ExpertChatThreadSummary[]; savedAt: number }>();
const expertThreadsInflight = new Map<string, Promise<ExpertChatThreadSummary[]>>();

function directionRoomKey(token: string, surveyDate?: string): string {
  const d = surveyDate?.trim().slice(0, 10) ?? "";
  return `${token}|${d}`;
}

function eligKey(token: string, surveyDate?: string): string {
  const d = surveyDate?.trim().slice(0, 10) ?? "";
  return `${token}|${d}`;
}

function myRespKey(token: string, surveyDate?: string): string {
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

/** AppTabNav·고수 탭 즉시 페인트 — 아직 유효한 eligibility만 */
export function peekExpertEligibilityCached(
  token: string,
  surveyDate?: string,
): ExpertChatEligibility | null {
  const key = eligKey(token, surveyDate);
  const hit = eligCache.get(key);
  if (hit && Date.now() - hit.savedAt < ELIG_TTL_MS) {
    return hit.data;
  }
  return null;
}

/** 고수 탭 스레드 목록 dedupe */
export async function getExpertChatThreadsCached(token: string): Promise<ExpertChatThreadSummary[]> {
  const now = Date.now();
  const hit = expertThreadsCache.get(token);
  if (hit && now - hit.savedAt < EXPERT_THREADS_TTL_MS) {
    return hit.data;
  }
  const inflight = expertThreadsInflight.get(token);
  if (inflight) return inflight;

  const promise = getExpertChatThreads(token).then(({ threads }) => {
    expertThreadsCache.set(token, { data: threads, savedAt: Date.now() });
    expertThreadsInflight.delete(token);
    return threads;
  });
  expertThreadsInflight.set(token, promise);
  promise.catch(() => {
    expertThreadsInflight.delete(token);
  });
  return promise;
}

export function invalidateExpertChatThreadsCache(): void {
  expertThreadsCache.clear();
  expertThreadsInflight.clear();
}

/** 설문·대시 — 거래일별 my-response 중복 방지 (HAR: Next 라우트 3회+프록시) */
export async function getMySurveyResponseCached(
  token: string,
  surveyDate?: string,
): Promise<MySurveyResponse> {
  const key = myRespKey(token, surveyDate);
  const now = Date.now();
  const hit = myRespCache.get(key);
  if (hit && now - hit.savedAt < MY_RESP_TTL_MS) {
    return hit.data;
  }
  const inflight = myRespInflight.get(key);
  if (inflight) return inflight;

  const promise = getMySurveyResponse(token, surveyDate).then((data) => {
    myRespCache.set(key, { data, savedAt: Date.now() });
    myRespInflight.delete(key);
    return data;
  });
  myRespInflight.set(key, promise);
  promise.catch(() => {
    myRespInflight.delete(key);
  });
  return promise;
}

/** 상점 소모품 grant — 설문 탭 refreshPendingGrants 중복 완화 */
export async function getPendingGrantCached(
  token: string,
  surveyDate: string,
): Promise<string | null> {
  const key = `${token}|${surveyDate.trim().slice(0, 10)}`;
  const now = Date.now();
  const hit = pendingGrantCache.get(key);
  if (hit && now - hit.savedAt < PENDING_GRANT_TTL_MS) {
    return hit.grantKind;
  }
  const inflight = pendingGrantInflight.get(key);
  if (inflight) return inflight;

  const promise = getPendingGrant(token, surveyDate).then((data) => {
    const grantKind = typeof data.grant_kind === "string" ? data.grant_kind : null;
    pendingGrantCache.set(key, { grantKind, savedAt: Date.now() });
    pendingGrantInflight.delete(key);
    return grantKind;
  });
  pendingGrantInflight.set(key, promise);
  promise.catch(() => {
    pendingGrantInflight.delete(key);
  });
  return promise;
}

/** 설문 탭·프리패치 — 동시 호출 dedupe (HAR: summary 2회 → 1회) */
export async function getTodaySummaryCached(): Promise<TodaySurvey> {
  const now = Date.now();
  if (todaySummaryCache && now - todaySummaryCache.savedAt < TODAY_SUMMARY_TTL_MS) {
    return todaySummaryCache.data;
  }
  if (todaySummaryInflight) return todaySummaryInflight;

  const promise = getTodaySummary().then((data) => {
    todaySummaryCache = { data, savedAt: Date.now() };
    todaySummaryInflight = null;
    return data;
  });
  todaySummaryInflight = promise;
  promise.catch(() => {
    todaySummaryInflight = null;
  });
  return promise;
}

export function invalidateTodaySummaryCache(): void {
  todaySummaryCache = null;
  todaySummaryInflight = null;
}

/** 소통방 탭 — room 1회 조회 dedupe */
export async function getDirectionChatRoomCached(
  token: string,
  surveyDate?: string,
): Promise<DirectionChatRoom> {
  const key = directionRoomKey(token, surveyDate);
  const now = Date.now();
  const hit = directionRoomCache.get(key);
  if (hit && now - hit.savedAt < DIRECTION_ROOM_TTL_MS) {
    return hit.data;
  }
  const inflight = directionRoomInflight.get(key);
  if (inflight) return inflight;

  const promise = getDirectionChatRoom(token, surveyDate).then((data) => {
    directionRoomCache.set(key, { data, savedAt: Date.now() });
    directionRoomInflight.delete(key);
    return data;
  });
  directionRoomInflight.set(key, promise);
  promise.catch(() => {
    directionRoomInflight.delete(key);
  });
  return promise;
}

export function invalidateDirectionChatRoomCache(): void {
  directionRoomCache.clear();
  directionRoomInflight.clear();
}

/** summary에 next_survey 없을 때만 — 별도 /api/next-survey 1회 */
export async function fetchNextSurveyCached(): Promise<NextSurveyInfo | null> {
  const now = Date.now();
  if (nextSurveyCache && now - nextSurveyCache.savedAt < NEXT_SURVEY_TTL_MS) {
    return nextSurveyCache.data;
  }
  if (nextSurveyInflight) return nextSurveyInflight;

  nextSurveyInflight = (async () => {
    try {
      const res = await fetch("/api/next-survey", { cache: "no-store" });
      if (!res.ok) {
        nextSurveyCache = { data: null, savedAt: Date.now() };
        return null;
      }
      const data = (await res.json()) as NextSurveyInfo;
      nextSurveyCache = { data, savedAt: Date.now() };
      return data;
    } catch {
      return null;
    } finally {
      nextSurveyInflight = null;
    }
  })();

  return nextSurveyInflight;
}

export function invalidateMeCache(): void {
  meCache = null;
  meInflight = null;
}

export function invalidateExpertEligibilityCache(): void {
  eligCache.clear();
  eligInflight.clear();
}

export function invalidateMySurveyResponseCache(): void {
  myRespCache.clear();
  myRespInflight.clear();
}

export function invalidatePendingGrantCache(): void {
  pendingGrantCache.clear();
  pendingGrantInflight.clear();
}

export function clearSessionApiCache(): void {
  invalidateMeCache();
  invalidateExpertEligibilityCache();
  invalidateMySurveyResponseCache();
  invalidatePendingGrantCache();
  invalidateTodaySummaryCache();
  invalidateDirectionChatRoomCache();
  invalidateExpertChatThreadsCache();
  nextSurveyCache = null;
  nextSurveyInflight = null;
}
