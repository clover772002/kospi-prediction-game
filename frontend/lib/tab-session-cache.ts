import type { Challenge, DashboardData, Group, TodaySurvey, UserProfile } from "@/lib/api";

/** 탭 왕복 시 즉시 그리기용 스냅샷 (신선 데이터는 백그라운드에서 다시 받음) */
export type DashboardTabSnapshot = {
  user: UserProfile;
  today: TodaySurvey;
  dash: DashboardData;
  challenges: { sent: Challenge[]; received: Challenge[] };
  groups: Group[];
  savedAt: number;
};

let dashboardSnap: DashboardTabSnapshot | null = null;

/** 최근 스냅샷 TTL — 너무 오래된 값은 버림 */
const DASHBOARD_SNAPSHOT_TTL_MS = 55_000;

export function peekDashboardSnapshot(): DashboardTabSnapshot | null {
  if (!dashboardSnap) return null;
  if (Date.now() - dashboardSnap.savedAt > DASHBOARD_SNAPSHOT_TTL_MS) {
    dashboardSnap = null;
    return null;
  }
  return dashboardSnap;
}

export function saveDashboardSnapshot(payload: Omit<DashboardTabSnapshot, "savedAt">): void {
  dashboardSnap = { ...payload, savedAt: Date.now() };
}

export function clearDashboardSnapshot(): void {
  dashboardSnap = null;
}
