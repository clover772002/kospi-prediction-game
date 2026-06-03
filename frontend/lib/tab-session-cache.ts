import type {
  Challenge,
  DashboardData,
  DirectionChatMessageRow,
  DirectionChatStatus,
  ExpertChatEligibility,
  ExpertChatThreadSummary,
  Group,
  ShopCatalog,
  TodaySurvey,
  UserProfile,
} from "@/lib/api";
import { clearSessionApiCache } from "@/lib/session-api-cache";

/** 탭 왕복·새로고침 직후에도 즉시 그리기용 스냅샷 (백그라운드에서 최신화) */
export type DashboardTabSnapshot = {
  user: UserProfile;
  today: TodaySurvey;
  dash: DashboardData;
  challenges: { sent: Challenge[]; received: Challenge[] };
  groups: Group[];
  savedAt: number;
};

export type ShopTabSnapshot = {
  catalog: ShopCatalog;
  walletTokens: number | null;
  savedAt: number;
};

export type SurveyTodaySnapshot = {
  today: TodaySurvey;
  savedAt: number;
};

export type GroupsTabSnapshot = {
  groups: Group[];
  savedAt: number;
};

export type TeamChatTabSnapshot = {
  surveyDate: string;
  status: DirectionChatStatus;
  messages: DirectionChatMessageRow[];
  savedAt: number;
};

export type ExpertChatTabSnapshot = {
  surveyDate: string;
  eligibility: ExpertChatEligibility;
  threads: ExpertChatThreadSummary[];
  savedAt: number;
};

const STORAGE_KEY = "kp_dash_snap_v1";
const TEAM_CHAT_KEY = "kp_team_chat_snap_v1";
const EXPERT_CHAT_KEY = "kp_expert_chat_snap_v1";
const SHOP_KEY = "kp_shop_snap_v1";
const SURVEY_TODAY_KEY = "kp_survey_today_snap_v1";
const GROUPS_KEY = "kp_groups_snap_v1";

let dashboardSnap: DashboardTabSnapshot | null = null;

/** 메모리·sessionStorage 공통 TTL (탭 왕복·새로고침 직후 재사용) */
const DASHBOARD_SNAPSHOT_TTL_MS = 180_000;

function readStorageSnapshot(): DashboardTabSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardTabSnapshot;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > DASHBOARD_SNAPSHOT_TTL_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    return null;
  }
}

export function peekDashboardSnapshot(): DashboardTabSnapshot | null {
  if (dashboardSnap && Date.now() - dashboardSnap.savedAt <= DASHBOARD_SNAPSHOT_TTL_MS) {
    return dashboardSnap;
  }
  dashboardSnap = null;

  const fromSs = readStorageSnapshot();
  if (fromSs) {
    dashboardSnap = fromSs;
    return fromSs;
  }
  return null;
}

export function saveDashboardSnapshot(payload: Omit<DashboardTabSnapshot, "savedAt">): void {
  const full: DashboardTabSnapshot = { ...payload, savedAt: Date.now() };
  dashboardSnap = full;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(full));
    } catch {
      /* 용량 초과 등 — 무시하고 메모리만 유지 */
    }
  }
}

export function clearDashboardSnapshot(): void {
  dashboardSnap = null;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }
}

// ── 상점 ─────────────────────────────────────────────────────

let shopSnapMemory: ShopTabSnapshot | null = null;

function readShopFromStorage(): ShopTabSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SHOP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShopTabSnapshot;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > DASHBOARD_SNAPSHOT_TTL_MS) {
      sessionStorage.removeItem(SHOP_KEY);
      return null;
    }
    return parsed;
  } catch {
    try {
      sessionStorage.removeItem(SHOP_KEY);
    } catch {
      /* noop */
    }
    return null;
  }
}

export function peekShopSnapshot(): ShopTabSnapshot | null {
  if (shopSnapMemory && Date.now() - shopSnapMemory.savedAt <= DASHBOARD_SNAPSHOT_TTL_MS) {
    return shopSnapMemory;
  }
  shopSnapMemory = null;
  const s = readShopFromStorage();
  if (s) {
    shopSnapMemory = s;
    return s;
  }
  return null;
}

export function saveShopSnapshot(payload: Omit<ShopTabSnapshot, "savedAt">): void {
  const full: ShopTabSnapshot = { ...payload, savedAt: Date.now() };
  shopSnapMemory = full;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(SHOP_KEY, JSON.stringify(full));
    } catch {
      /* noop */
    }
  }
}

export function clearShopSnapshot(): void {
  shopSnapMemory = null;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(SHOP_KEY);
    } catch {
      /* noop */
    }
  }
}

// ── 설문 (/today) ─────────────────────────────────────────────

let surveyTodayMemory: SurveyTodaySnapshot | null = null;

function readSurveyTodayFromStorage(): SurveyTodaySnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SURVEY_TODAY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SurveyTodaySnapshot;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > DASHBOARD_SNAPSHOT_TTL_MS) {
      sessionStorage.removeItem(SURVEY_TODAY_KEY);
      return null;
    }
    return parsed;
  } catch {
    try {
      sessionStorage.removeItem(SURVEY_TODAY_KEY);
    } catch {
      /* noop */
    }
    return null;
  }
}

export function peekSurveyTodaySnapshot(): SurveyTodaySnapshot | null {
  if (surveyTodayMemory && Date.now() - surveyTodayMemory.savedAt <= DASHBOARD_SNAPSHOT_TTL_MS) {
    return surveyTodayMemory;
  }
  surveyTodayMemory = null;
  const s = readSurveyTodayFromStorage();
  if (s) {
    surveyTodayMemory = s;
    return s;
  }
  return null;
}

export function saveSurveyTodaySnapshot(today: TodaySurvey): void {
  const full: SurveyTodaySnapshot = { today, savedAt: Date.now() };
  surveyTodayMemory = full;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(SURVEY_TODAY_KEY, JSON.stringify(full));
    } catch {
      /* noop */
    }
  }
}

export function clearSurveyTodaySnapshot(): void {
  surveyTodayMemory = null;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(SURVEY_TODAY_KEY);
    } catch {
      /* noop */
    }
  }
}

// ── 다음 거래일 사전 예측 ────────────────────────────────────

export type SurveyNextSnapshot = {
  survey_date: string;
  is_open: boolean;
  savedAt: number;
};

const SURVEY_NEXT_KEY = "tab_survey_next_v1";
let surveyNextMemory: SurveyNextSnapshot | null = null;

// ── 오늘 설문 참여 여부 (대시보드 게이트 즉시 판정) ─────────────

type AnsweredTodaySnapshot = {
  surveyDate: string;
  answered: boolean;
  savedAt: number;
};

const ANSWERED_TODAY_KEY = "kp_answered_today_v1";
let answeredTodayMemory: AnsweredTodaySnapshot | null = null;

function surveyDateKey(d: string): string {
  return d.trim().slice(0, 10);
}

export function peekAnsweredToday(surveyDate: string): boolean | null {
  const key = surveyDateKey(surveyDate);
  if (
    answeredTodayMemory &&
    answeredTodayMemory.surveyDate === key &&
    Date.now() - answeredTodayMemory.savedAt <= DASHBOARD_SNAPSHOT_TTL_MS
  ) {
    return answeredTodayMemory.answered;
  }
  answeredTodayMemory = null;
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ANSWERED_TODAY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnsweredTodaySnapshot;
    if (
      !parsed?.savedAt ||
      parsed.surveyDate !== key ||
      Date.now() - parsed.savedAt > DASHBOARD_SNAPSHOT_TTL_MS
    ) {
      sessionStorage.removeItem(ANSWERED_TODAY_KEY);
      return null;
    }
    answeredTodayMemory = parsed;
    return parsed.answered;
  } catch {
    return null;
  }
}

export function saveAnsweredToday(surveyDate: string, answered: boolean): void {
  const full: AnsweredTodaySnapshot = {
    surveyDate: surveyDateKey(surveyDate),
    answered,
    savedAt: Date.now(),
  };
  answeredTodayMemory = full;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(ANSWERED_TODAY_KEY, JSON.stringify(full));
    } catch {
      /* noop */
    }
  }
}

export function clearAnsweredTodaySnapshot(): void {
  answeredTodayMemory = null;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(ANSWERED_TODAY_KEY);
    } catch {
      /* noop */
    }
  }
}

export function peekSurveyNextSnapshot(): Pick<SurveyNextSnapshot, "survey_date" | "is_open"> | null {
  if (surveyNextMemory && Date.now() - surveyNextMemory.savedAt <= DASHBOARD_SNAPSHOT_TTL_MS) {
    return { survey_date: surveyNextMemory.survey_date, is_open: surveyNextMemory.is_open };
  }
  surveyNextMemory = null;
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SURVEY_NEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SurveyNextSnapshot;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > DASHBOARD_SNAPSHOT_TTL_MS) {
      sessionStorage.removeItem(SURVEY_NEXT_KEY);
      return null;
    }
    surveyNextMemory = parsed;
    return { survey_date: parsed.survey_date, is_open: parsed.is_open };
  } catch {
    return null;
  }
}

export function saveSurveyNextSnapshot(next: { survey_date: string; is_open: boolean }): void {
  const full: SurveyNextSnapshot = { ...next, savedAt: Date.now() };
  surveyNextMemory = full;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(SURVEY_NEXT_KEY, JSON.stringify(full));
    } catch {
      /* noop */
    }
  }
}

export function clearSurveyNextSnapshot(): void {
  surveyNextMemory = null;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(SURVEY_NEXT_KEY);
    } catch {
      /* noop */
    }
  }
}

// ── 그룹 목록 ────────────────────────────────────────────────

let groupsSnapMemory: GroupsTabSnapshot | null = null;

function readGroupsFromStorage(): GroupsTabSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(GROUPS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GroupsTabSnapshot;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > DASHBOARD_SNAPSHOT_TTL_MS) {
      sessionStorage.removeItem(GROUPS_KEY);
      return null;
    }
    return parsed;
  } catch {
    try {
      sessionStorage.removeItem(GROUPS_KEY);
    } catch {
      /* noop */
    }
    return null;
  }
}

export function peekGroupsSnapshot(): GroupsTabSnapshot | null {
  if (groupsSnapMemory && Date.now() - groupsSnapMemory.savedAt <= DASHBOARD_SNAPSHOT_TTL_MS) {
    return groupsSnapMemory;
  }
  groupsSnapMemory = null;
  const s = readGroupsFromStorage();
  if (s) {
    groupsSnapMemory = s;
    return s;
  }
  return null;
}

export function saveGroupsSnapshot(groups: Group[]): void {
  const full: GroupsTabSnapshot = { groups, savedAt: Date.now() };
  groupsSnapMemory = full;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(GROUPS_KEY, JSON.stringify(full));
    } catch {
      /* noop */
    }
  }
}

export function clearGroupsSnapshot(): void {
  groupsSnapMemory = null;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(GROUPS_KEY);
    } catch {
      /* noop */
    }
  }
}

// ── 소통방 (/team-chat) ───────────────────────────────────────

let teamChatMemory: TeamChatTabSnapshot | null = null;

function readTeamChatFromStorage(): TeamChatTabSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(TEAM_CHAT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TeamChatTabSnapshot;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > DASHBOARD_SNAPSHOT_TTL_MS) {
      sessionStorage.removeItem(TEAM_CHAT_KEY);
      return null;
    }
    return parsed;
  } catch {
    try {
      sessionStorage.removeItem(TEAM_CHAT_KEY);
    } catch {
      /* noop */
    }
    return null;
  }
}

export function peekTeamChatSnapshot(): TeamChatTabSnapshot | null {
  if (teamChatMemory && Date.now() - teamChatMemory.savedAt <= DASHBOARD_SNAPSHOT_TTL_MS) {
    return teamChatMemory;
  }
  teamChatMemory = null;
  const s = readTeamChatFromStorage();
  if (s) {
    teamChatMemory = s;
    return s;
  }
  return null;
}

export function saveTeamChatSnapshot(
  surveyDate: string,
  status: DirectionChatStatus,
  messages: DirectionChatMessageRow[],
): void {
  const full: TeamChatTabSnapshot = {
    surveyDate: surveyDate.slice(0, 10),
    status,
    messages,
    savedAt: Date.now(),
  };
  teamChatMemory = full;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(TEAM_CHAT_KEY, JSON.stringify(full));
    } catch {
      /* noop */
    }
  }
}

export function clearTeamChatSnapshot(): void {
  teamChatMemory = null;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(TEAM_CHAT_KEY);
    } catch {
      /* noop */
    }
  }
}

// ── 고수 소통 (/expert-chat) ──────────────────────────────────

let expertChatMemory: ExpertChatTabSnapshot | null = null;

function readExpertChatFromStorage(): ExpertChatTabSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(EXPERT_CHAT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExpertChatTabSnapshot;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > DASHBOARD_SNAPSHOT_TTL_MS) {
      sessionStorage.removeItem(EXPERT_CHAT_KEY);
      return null;
    }
    return parsed;
  } catch {
    try {
      sessionStorage.removeItem(EXPERT_CHAT_KEY);
    } catch {
      /* noop */
    }
    return null;
  }
}

export function peekExpertChatSnapshot(): ExpertChatTabSnapshot | null {
  if (expertChatMemory && Date.now() - expertChatMemory.savedAt <= DASHBOARD_SNAPSHOT_TTL_MS) {
    return expertChatMemory;
  }
  expertChatMemory = null;
  const s = readExpertChatFromStorage();
  if (s) {
    expertChatMemory = s;
    return s;
  }
  return null;
}

export function saveExpertChatSnapshot(
  surveyDate: string,
  eligibility: ExpertChatEligibility,
  threads: ExpertChatThreadSummary[],
): void {
  const full: ExpertChatTabSnapshot = {
    surveyDate: surveyDate.slice(0, 10),
    eligibility,
    threads,
    savedAt: Date.now(),
  };
  expertChatMemory = full;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(EXPERT_CHAT_KEY, JSON.stringify(full));
    } catch {
      /* noop */
    }
  }
}

export function clearExpertChatSnapshot(): void {
  expertChatMemory = null;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(EXPERT_CHAT_KEY);
    } catch {
      /* noop */
    }
  }
}

/** 로그아웃 시 탭 스냅샷 전부 제거 */
export function clearAllTabSnapshots(): void {
  clearDashboardSnapshot();
  clearShopSnapshot();
  clearSurveyTodaySnapshot();
  clearSurveyNextSnapshot();
  clearGroupsSnapshot();
  clearTeamChatSnapshot();
  clearExpertChatSnapshot();
  clearAnsweredTodaySnapshot();
  clearSessionApiCache();
}

/**
 * 앱 탭(설문·대시보드·상점·그룹) 공통 첫 페인트용 캐시가 모두 있는지.
 * 부트스트랩 프리패치 완료 후 true.
 */
export function isAppTabCacheWarm(): boolean {
  if (typeof window === "undefined") return false;
  return !!(
    peekDashboardSnapshot() &&
    peekSurveyTodaySnapshot() &&
    peekShopSnapshot() &&
    peekGroupsSnapshot()
  );
}
