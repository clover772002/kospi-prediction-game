import type { Challenge, DashboardData, Group, TodaySurvey, UserProfile } from "@/lib/api";

/** 탭 왕복·새로고침 직후에도 즉시 그리기용 스냅샷 (백그라운드에서 최신화) */
export type DashboardTabSnapshot = {
  user: UserProfile;
  today: TodaySurvey;
  dash: DashboardData;
  challenges: { sent: Challenge[]; received: Challenge[] };
  groups: Group[];
  savedAt: number;
};

const STORAGE_KEY = "kp_dash_snap_v1";

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
