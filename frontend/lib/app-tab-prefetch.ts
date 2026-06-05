/**
 * 로그인 후 첫 앱 탭 진입 시 한 번에 호출 — tab-session-cache 스냅샷을 모두 채웁니다.
 */
import type { Challenge, Group } from "@/lib/api";
import {
  getDashboardSummary,
  getDashboard,
  getMyChallenges,
  getMyGroups,
  getShopCatalog,
} from "@/lib/api";
import {
  getDirectionChatRoomCached,
  getExpertChatEligibilityCached,
  getExpertChatThreadsCached,
  getMeCached,
  getTodaySummaryCached,
} from "@/lib/session-api-cache";
import {
  saveDashboardSnapshot,
  saveExpertChatSnapshot,
  saveGroupsSnapshot,
  saveShopSnapshot,
  saveSurveyNextSnapshot,
  saveSurveyTodaySnapshot,
  saveTeamChatSnapshot,
} from "@/lib/tab-session-cache";

export const APP_TAB_BOOT_MESSAGES = [
  "로그인·프로필 확인 중…",
  "오늘 선택·시장 정보 받는 중…",
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
    const [profile, todayData, dashSummary, chResult, grpResult, catalog] = await Promise.all([
      withTimeout(getMeCached(accessToken), 25_000),
      withTimeout(getTodaySummaryCached(), 20_000),
      withTimeout(getDashboardSummary(accessToken), 20_000),
      withTimeout(getMyChallenges(accessToken)).catch(() => EMPTY_CHALLENGES),
      withTimeout(getMyGroups(accessToken)).catch(() => [] as Group[]),
      withTimeout(getShopCatalog(accessToken)).catch(() => null),
    ]);

    let dashData = dashSummary;
    void withTimeout(getDashboard(accessToken), 45_000)
      .then((full) => {
        dashData = full;
        saveDashboardSnapshot({
          user: profile,
          today: todayData,
          dash: full,
          challenges: chResult,
          groups: grpResult,
        });
      })
      .catch(() => {});

    const walletTokens = typeof dashData.tokens === "number" ? dashData.tokens : null;

    saveDashboardSnapshot({
      user: profile,
      today: todayData,
      dash: dashData,
      challenges: chResult,
      groups: grpResult,
    });
    // full dashboard는 위 .then 에서 스냅샷 갱신
    saveSurveyTodaySnapshot(todayData);
    if (todayData.next_survey?.survey_date) {
      saveSurveyNextSnapshot(todayData.next_survey);
    }
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

    const sdTeam = todayData.survey_date?.slice(0, 10);
    if (sdTeam) {
      void withTimeout(getDirectionChatRoomCached(accessToken, sdTeam), 25_000)
        .then((room) => {
          const { messages, ...st } = room;
          saveTeamChatSnapshot(room.survey_date, st, messages);
        })
        .catch(() => {});

      void (async () => {
        try {
          const e = await withTimeout(getExpertChatEligibilityCached(accessToken, sdTeam), 20_000);
          let threads: Awaited<ReturnType<typeof getExpertChatThreadsCached>> = [];
          if (e.can_access_expert_chat) {
            threads = await withTimeout(getExpertChatThreadsCached(accessToken), 20_000);
          }
          saveExpertChatSnapshot(sdTeam, e, threads);
        } catch {
          /* 고수 탭은 백그라운드 워밍 */
        }
      })();
    }

    onProgress?.("준비 완료!");
  } finally {
    if (typeof window !== "undefined" && rot != null) window.clearInterval(rot);
  }
}
