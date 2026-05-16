/**
 * 로그인 후 첫 앱 탭 진입 시 한 번에 호출 — tab-session-cache 스냅샷을 모두 채웁니다.
 */
import type { Challenge, Group } from "@/lib/api";
import {
  getDashboard,
  getMe,
  getMyChallenges,
  getMyGroups,
  getShopCatalog,
  getToday,
} from "@/lib/api";
import {
  saveDashboardSnapshot,
  saveGroupsSnapshot,
  saveShopSnapshot,
  saveSurveyTodaySnapshot,
} from "@/lib/tab-session-cache";

export const APP_TAB_BOOT_MESSAGES = [
  "로그인·프로필 확인 중…",
  "오늘 설문·시장 정보 받는 중…",
  "대시보드·예측 이력 받는 중…",
  "그룹·대결 목록 받는 중…",
  "상점·아이템 목록 받는 중…",
  "정리하는 중…",
] as const;

function withTimeout<T>(p: Promise<T>, ms = 60_000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`요청 시간 초과 (${ms / 1000}초)`)), ms),
    ),
  ]);
}

const EMPTY_CHALLENGES = { sent: [] as Challenge[], received: [] as Challenge[] };

export async function runAppTabPrefetch(
  accessToken: string,
  onProgress?: (message: string) => void,
): Promise<void> {
  let msgIndex = 0;
  const tick = () => {
    const msg =
      APP_TAB_BOOT_MESSAGES[msgIndex] ?? APP_TAB_BOOT_MESSAGES[APP_TAB_BOOT_MESSAGES.length - 1];
    msgIndex = Math.min(msgIndex + 1, APP_TAB_BOOT_MESSAGES.length - 1);
    onProgress?.(msg);
  };
  tick();
  const rot =
    typeof window !== "undefined"
      ? window.setInterval(tick, 650)
      : (null as unknown as number);

  try {
    const [profile, todayData, dashData, chResult, grpResult, catalog] = await Promise.all([
      withTimeout(getMe(accessToken), 25_000),
      withTimeout(getToday(), 45_000),
      withTimeout(getDashboard(accessToken), 60_000),
      withTimeout(getMyChallenges(accessToken)).catch(() => EMPTY_CHALLENGES),
      withTimeout(getMyGroups(accessToken)).catch(() => [] as Group[]),
      withTimeout(getShopCatalog(accessToken)).catch(() => null),
    ]);

    const walletTokens = typeof dashData.tokens === "number" ? dashData.tokens : null;

    saveDashboardSnapshot({
      user: profile,
      today: todayData,
      dash: dashData,
      challenges: chResult,
      groups: grpResult,
    });
    saveSurveyTodaySnapshot(todayData);
    saveGroupsSnapshot(grpResult);

    if (catalog) {
      saveShopSnapshot({ catalog, walletTokens });
    } else {
      saveShopSnapshot({
        catalog: {
          insight_products: [],
          consumable_products: [],
          token_packs: [],
          stripe_ready: false,
          paywall_enabled: false,
        },
        walletTokens,
      });
    }

    onProgress?.("준비 완료!");
  } finally {
    if (typeof window !== "undefined" && rot != null) window.clearInterval(rot);
  }
}
