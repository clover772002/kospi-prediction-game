"use client";

import { Suspense, useEffect, useState, useCallback, useRef, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMe, getToday, getDashboard, createChallenge, getMyChallenges, reactToChallenge, requestRematch, acceptChallenge, declineChallenge, getMyGroups, UserProfile, TodaySurvey, DashboardData, Challenge, Group } from "@/lib/api";
import ShareSheet from "@/components/ShareSheet";
import AppAmbientBackground from "@/components/AppAmbientBackground";
import AppTabNav from "@/components/AppTabNav";
import DashboardInsightSection, { DashboardInsightSectionSkeleton } from "@/components/DashboardInsightSection";
import CrowdGaugeBoxplotsSection from "@/components/CrowdGaugeBoxplotsSection";
import StaleRefreshIndicator from "@/components/StaleRefreshIndicator";
import { clearAllTabSnapshots, peekDashboardSnapshot, saveDashboardSnapshot, saveGroupsSnapshot } from "@/lib/tab-session-cache";

type DashboardHist = DashboardData["history"][number];

function coerceBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "t" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "f" || s === "no") return false;
  }
  if (v === 1 || v === "1") return true;
  if (v === 0 || v === "0") return false;
  return null;
}

function sameSurveyDate(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().slice(0, 10) === b.trim().slice(0, 10);
}

/** accuracy·시장결과·오늘 카드 중 하나라도 있으면 적중 여부 */
function effectiveKospiCorrect(entry: DashboardHist | undefined): boolean | null {
  if (!entry) return null;
  const hc = entry.kospi_correct;
  if (typeof hc === "boolean") return hc;
  const mk = coerceBool(entry.kospi_market_result);
  if (mk !== null) return entry.kospi_answer === mk;
  return null;
}

/** daily_surveys.kospi_result가 비어 있어도 accuracy_records가 있으면 맞춤/틀림 표시 */
function userPickVerdictFromTodayAndHistory(
  today: TodaySurvey | null | undefined,
  entry: DashboardHist | undefined,
): boolean | null {
  if (!entry) return null;
  const kr = coerceBool(today?.kospi_result);
  if (kr !== null) return entry.kospi_answer === kr;
  return effectiveKospiCorrect(entry);
}

/** 집단용: 일간 행 또는 내 이력으로 실제 등락 방향 복구(기록 불일치 대비) */
function resolvedMarketDirection(
  today: TodaySurvey | null | undefined,
  entry: DashboardHist | undefined,
): boolean | null {
  const kr = coerceBool(today?.kospi_result);
  if (kr !== null) return kr;
  const mk = coerceBool(entry?.kospi_market_result);
  if (mk !== null) return mk;
  if (!entry) return null;
  const hc = entry.kospi_correct;
  if (typeof hc !== "boolean") return null;
  return hc ? entry.kospi_answer : !entry.kospi_answer;
}

// 연속 적중 스트릭 계산
function calcStreak(history: DashboardData["history"]): number {
  const withResult = [...history].filter((h) => effectiveKospiCorrect(h) !== null);
  let count = 0;
  for (const item of withResult) {
    if (effectiveKospiCorrect(item) === true) count++;
    else break;
  }
  return count;
}

function HistoryRow({ item }: { item: DashboardData["history"][0] }) {
  const verdict = effectiveKospiCorrect(item);
  const hasResult = verdict !== null;
  const gauge = item.gauge_position;
  const isUpBet = gauge !== null && gauge !== undefined ? gauge > 0 : item.kospi_answer;
  const tokensWon = item.tokens_won;
  const tokensBet = item.tokens_bet;

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl px-3 py-3 border ${
      hasResult
        ? verdict
          ? "bg-green-500/5 border-green-500/20"
          : "bg-red-500/5 border-red-500/20"
        : "bg-[#1A1A1A] border-[#2A2A2A]"
    }`}>
      <p className="text-xs text-gray-500 w-16 flex-shrink-0">{item.date.slice(5)}</p>

      <div className="flex-1 min-w-[120px] flex items-center gap-2 text-xs">
        <span className={isUpBet ? "text-red-400 font-bold" : "text-blue-400 font-bold"}>
          {isUpBet ? "📈" : "📉"}
          {gauge !== null && gauge !== undefined ? ` ${gauge > 0 ? "+" : ""}${gauge}%` : ""}
        </span>
        {tokensBet != null && (
          <span className="text-gray-500">{tokensBet}T 배팅</span>
        )}
      </div>

      <div className="flex-shrink-0 text-xs text-right flex items-center gap-2 ml-auto">
        {hasResult ? (
          <div className="flex items-center gap-1.5">
            <span>{verdict ? "✅" : "❌"}</span>
            {tokensWon !== null && tokensWon !== undefined && (
              <span className={`font-bold tabular-nums ${tokensWon >= 0 ? "text-green-400" : "text-red-400"}`}>
                {tokensWon >= 0 ? "+" : ""}{tokensWon}T
              </span>
            )}
          </div>
        ) : (
          <span className="text-gray-600">대기중</span>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser]       = useState<UserProfile | null>(null);
  const [today, setToday]     = useState<TodaySurvey | null>(null);
  const [dash, setDash]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [token, setToken]     = useState<string | null>(null);
  const [showResultCard, setShowResultCard] = useState(false);
  const [challenges, setChallenges]         = useState<{ sent: Challenge[]; received: Challenge[] } | null>(null);
  const [challengeLoading, setChallengeLoading]   = useState<string | null>(null);
  const [challengeToast, setChallengeToast]       = useState<string | null>(null);
  const [reactingId, setReactingId]               = useState<string | null>(null); // challenge id 이모티콘 피커 열림
  const [rematchLoading, setRematchLoading]        = useState<string | null>(null);
  const [acceptLoading, setAcceptLoading]          = useState<string | null>(null); // challenge_id
  const [revalidating, setRevalidating]            = useState(false);
  const dashboardFetchSeq = useRef(0);

  useLayoutEffect(() => {
    const cached = peekDashboardSnapshot();
    if (cached) {
      setUser(cached.user);
      setToday(cached.today);
      setDash(cached.dash);
      setChallenges(cached.challenges);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadData = async (accessToken: string) => {
      const seq = ++dashboardFetchSeq.current;
      setToken(accessToken);
      setRevalidating(true);
      try {
        const withTimeout = <T,>(p: Promise<T>, ms = 20000): Promise<T> =>
          Promise.race([
            p,
            new Promise<T>((_, reject) =>
              setTimeout(() => reject(new Error(`서버 응답 지연 (${ms / 1000}초). 잠시 후 다시 시도해주세요.`)), ms)
            ),
          ]);

        const [profile, todayData, dashData, chResult, grpResult] = await Promise.all([
          withTimeout(getMe(accessToken)),
          withTimeout(getToday()),
          withTimeout(getDashboard(accessToken), 60000),
          withTimeout(getMyChallenges(accessToken)).catch(() => ({ sent: [] as Challenge[], received: [] as Challenge[] })),
          withTimeout(getMyGroups(accessToken)).catch(() => [] as Group[]),
        ]);

        if (seq !== dashboardFetchSeq.current) return;

        setUser(profile);
        setToday(todayData);
        setDash(dashData);
        setChallenges(chResult);
        saveDashboardSnapshot({
          user: profile,
          today: todayData,
          dash: dashData,
          challenges: chResult,
          groups: grpResult,
        });

        if (todayData.status === "result" && todayData.survey_date) {
          const key = `result_card_${todayData.survey_date}`;
          if (!localStorage.getItem(key)) {
            const participated = dashData.history?.[0]?.date === todayData.survey_date;
            if (participated) {
              setTimeout(() => setShowResultCard(true), 800);
            }
          }
        }
      } catch (e: unknown) {
        if (seq !== dashboardFetchSeq.current) return;
        const msg = e instanceof Error ? e.message : String(e);
        console.error("데이터 로딩 오류:", msg);
        setError(msg);
      } finally {
        if (seq === dashboardFetchSeq.current) {
          setLoading(false);
          setRevalidating(false);
        }
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        clearAllTabSnapshots();
        setLoading(false);
        router.replace("/");
        return;
      }
      void loadData(session.access_token);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearAllTabSnapshots();
        router.replace("/");
        return;
      }
      if (event === "SIGNED_IN" && session) void loadData(session.access_token);
      if (event === "INITIAL_SESSION" && !session) {
        clearAllTabSnapshots();
        setLoading(false);
        router.replace("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    clearAllTabSnapshots();
    await supabase.auth.signOut();
    router.replace("/");
  };

  const refreshChallenges = async (surveyDate: string) => {
    if (!token) return;
    try {
      const ch = await getMyChallenges(token, surveyDate);
      setChallenges(ch);
    } catch { /* ignore */ }
  };

  const refreshDashboard = useCallback(async () => {
    if (!token) return;
    try {
      const dashData = await getDashboard(token);
      setDash(dashData);
    } catch {
      /* ignore */
    }
  }, [token]);

  const showToast = (msg: string) => {
    setChallengeToast(msg);
    setTimeout(() => setChallengeToast(null), 3000);
  };

  const handleAccept = async (challenge_id: string) => {
    if (!token) return;
    setAcceptLoading(challenge_id);
    try {
      const res = await acceptChallenge(token, challenge_id);
      setChallengeToast(`대결 수락! "${res.group_name}" 그룹이 생성됐어요 🔥`);
      const groups = await getMyGroups(token);
      const updated = await getMyChallenges(token);
      setChallenges(updated);
      saveGroupsSnapshot(groups);
      if (user && today && dash) {
        saveDashboardSnapshot({ user, today, dash, challenges: updated, groups });
      }
    } catch (e: unknown) {
      setChallengeToast(e instanceof Error ? e.message : "수락 실패");
    } finally {
      setAcceptLoading(null);
      setTimeout(() => setChallengeToast(null), 3000);
    }
  };

  const handleDecline = async (challenge_id: string) => {
    if (!token) return;
    try {
      await declineChallenge(token, challenge_id);
      setChallengeToast("대결을 거절했어요");
      const updated = await getMyChallenges(token);
      setChallenges(updated);
    } catch (e: unknown) {
      setChallengeToast(e instanceof Error ? e.message : "거절 실패");
    } finally {
      setTimeout(() => setChallengeToast(null), 2500);
    }
  };

  const handleChallenge = async (challenged_user_id: string, survey_date: string) => {
    if (!token) return;
    setChallengeLoading(challenged_user_id);
    try {
      await createChallenge(token, challenged_user_id, survey_date);
      await refreshChallenges(survey_date);
      showToast("⚔️ 대결 신청 완료! 상대에게 알림이 전송됐어요.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "대결 신청 실패");
    } finally {
      setChallengeLoading(null);
    }
  };

  const handleReact = async (challenge_id: string, reaction: string, survey_date: string) => {
    if (!token) return;
    setReactingId(null);
    try {
      await reactToChallenge(token, challenge_id, reaction);
      await refreshChallenges(survey_date);
      showToast(`${reaction} 반응을 보냈어요!`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "반응 전송 실패");
    }
  };

  const handleRematch = async (challenge_id: string, survey_date: string) => {
    if (!token) return;
    setRematchLoading(challenge_id);
    try {
      const res = await requestRematch(token, challenge_id);
      await refreshChallenges(survey_date);
      showToast(`🔥 재대결 신청! ${res.survey_date} 대결이 잡혔어요.`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "재대결 신청 실패");
    } finally {
      setRematchLoading(null);
    }
  };

  if (error) {
    return (
      <main className="relative max-w-md mx-auto min-h-screen flex items-center justify-center px-6">
        <AppAmbientBackground />
        <div className="relative z-10 text-center space-y-4">
          <div className="text-5xl">⚠️</div>
          <p className="font-bold text-lg">오류가 발생했습니다</p>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-left">
            <p className="text-red-400 text-sm font-mono break-all">{error}</p>
          </div>
          <p className="text-xs text-gray-500">
            서버가 잠시 느릴 수 있어요. 다시 시도해주세요.
          </p>
          <button
            onClick={() => { setError(null); setLoading(true); window.location.reload(); }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all"
          >
            다시 시도
          </button>
          <button
            onClick={handleLogout}
            className="block w-full text-xs text-gray-500 hover:text-gray-300"
          >
            로그아웃
          </button>
        </div>
      </main>
    );
  }

  // ── 블러 게이트 판정 ─────────────────────────────
  const isConnected = !!(user?.telegram_chat_id || user?.has_push);
  const surveyDay = today?.status !== "no_survey";
  const respondedToday = !!(
    dash?.history?.length &&
    today?.survey_date &&
    dash.history[0].date === today.survey_date
  );
  // 장마감 후(result)는 누구나 볼 수 있음
  const marketClosed = today?.status === "result";
  // 휴장일(no_survey)에도 게이트 없음 — 예측할 장이 없으므로 누구나 열람 가능
  // API status와 무관하게 클라이언트 사이드에서도 주말 여부 직접 체크 (이중 안전망)
  const isWeekendKST = (() => {
    const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const day = kst.getDay();
    return day === 0 || day === 6;
  })();
  const isHolidayDay = !surveyDay || isWeekendKST;
  // 연동 안 됨 → 최우선 / 장마감·휴장일은 게이트 없음
  const gateType: "not_connected" | "no_survey" | null =
    marketClosed || isHolidayDay ? null :
    !isConnected ? "not_connected" :
    !respondedToday ? "no_survey" :
    null;

  const statusColor: Record<string, string> = {
    no_survey: "#6B7280",
    open: "#F59E0B",
    closed: "#06B6D4",
    result: "#22C55E",
  };

  const status = today?.status ?? "no_survey";

  // 현재 시각 기준 장 상태 배너 (주말 별도 처리)
  function getMarketStatus(): { label: string; color: string } {
    const now = new Date();
    const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const day = kst.getDay();
    if (day === 0 || day === 6) return { label: "휴장", color: "#6B7280" };
    const mins = kst.getHours() * 60 + kst.getMinutes();
    if (mins < 9 * 60) return { label: "장시작전", color: "#6B7280" };
    if (mins < 15 * 60 + 30) return { label: "장중", color: "#F59E0B" };
    return { label: "장마감", color: "#22C55E" };
  }
  const marketStatus = getMarketStatus();

  // 스트릭 계산
  const streak = dash?.history ? calcStreak(dash.history) : 0;

  // 오늘 결과 공유용 데이터
  const todayEntry = dash?.history?.find((h) => sameSurveyDate(h.date, today?.survey_date));
  const isCorrectToday =
    todayEntry !== undefined ? userPickVerdictFromTodayAndHistory(today, todayEntry) : null;
  const resolvedMarketFromMe = resolvedMarketDirection(today, todayEntry);

  const handleCloseResultCard = () => {
    if (today?.survey_date) {
      localStorage.setItem(`result_card_${today.survey_date}`, "1");
    }
    setShowResultCard(false);
  };

  const handleShareResult = () => {
    const streakText = streak > 1 ? ` 🔥${streak}연속 적중!` : "";
    const verdict = userPickVerdictFromTodayAndHistory(today, todayEntry ?? undefined);
    const resultText = verdict === null ? "" : verdict ? "✅ 오늘 맞췄어요!" : "❌ 오늘 틀렸어요";
    const dir = resolvedMarketDirection(today, todayEntry ?? undefined);
    const kospiText =
      typeof dir === "boolean"
        ? dir
          ? `코스피 📈 상승 ${today?.kospi_change_pct != null ? `+${today.kospi_change_pct.toFixed(2)}%` : ""}`
          : `코스피 📉 하락 ${today?.kospi_change_pct != null ? `${today.kospi_change_pct.toFixed(2)}%` : ""}`
        : "코스피 결과 처리 중…";
    const accuracyText = dash?.accuracy?.kospi != null ? ` (내 적중률 ${dash.accuracy.kospi}%)` : "";
    const shareText = `${resultText}${streakText}\n${kospiText}${accuracyText}\n\n코스피 예측에 참여해봐요 👉`;
    const shareUrl = typeof window !== "undefined" ? window.location.origin : "";
    if (navigator.share) {
      navigator.share({ title: "코스피 예측 결과", text: shareText, url: shareUrl });
    } else {
      navigator.clipboard?.writeText(`${shareText}\n${shareUrl}`);
      alert("링크가 복사됐어요!");
    }
    handleCloseResultCard();
  };

  return (
    <main className="max-w-md mx-auto min-h-screen pb-36 px-5 relative">
      <StaleRefreshIndicator show={revalidating && !!dash && !!user} tone="sky" />
      <AppAmbientBackground />
      <div className="relative z-10">
      {/* ── 결과 공유 카드 팝업 ── */}
      {showResultCard && today && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-8"
          style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
          onClick={handleCloseResultCard}
        >
          <div
            className="w-full max-w-sm rounded-3xl overflow-hidden slide-up"
            style={{ background: "#0F0F0F", border: "1px solid #2A2A2A" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <p className="text-[10px] text-gray-600 tracking-widest uppercase">코스피 예측</p>
                <p className="text-sm font-bold text-white mt-0.5">
                  {today.survey_date
                    ? new Date(today.survey_date).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" })
                    : "오늘"}
                </p>
              </div>
              <span className="text-[11px] text-gray-500 bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-1 rounded-full">
                오늘 코스피, 함께 맞춰요
              </span>
            </div>

            <div className="px-5 pb-5 space-y-3">
              {/* KOSPI 결과 */}
              <div
                className={`rounded-2xl px-5 py-4 flex items-center justify-between border ${
                  resolvedMarketFromMe === null
                    ? "bg-gray-500/10 border-gray-500/25"
                    : resolvedMarketFromMe
                      ? "bg-green-500/10 border-green-500/25"
                      : "bg-red-500/10 border-red-500/25"
                }`}
              >
                <div>
                  <p className="text-[11px] text-gray-500 mb-1">KOSPI 오늘 결과</p>
                  <p
                    className={`text-3xl font-black tracking-tight ${
                      resolvedMarketFromMe === null
                        ? "text-gray-400"
                        : resolvedMarketFromMe
                          ? "text-green-400"
                          : "text-red-400"
                    }`}
                  >
                    {resolvedMarketFromMe === null
                      ? "확인 중"
                      : resolvedMarketFromMe
                        ? "상승"
                        : "하락"}
                    &nbsp;
                    {today.kospi_change_pct != null && resolvedMarketFromMe !== null
                      ? `${today.kospi_change_pct >= 0 ? "+" : ""}${today.kospi_change_pct.toFixed(2)}%`
                      : ""}
                  </p>
                </div>
                <span
                  className={`text-4xl font-black ${
                    resolvedMarketFromMe === null
                      ? "text-gray-500"
                      : resolvedMarketFromMe
                        ? "text-green-400"
                        : "text-red-400"
                  }`}
                >
                  {resolvedMarketFromMe === null ? "—" : resolvedMarketFromMe ? "▲" : "▼"}
                </span>
              </div>

              {/* 내 예측 */}
              <div
                className={`rounded-2xl px-4 py-3 flex items-center gap-4 border ${
                  isCorrectToday === null
                    ? "bg-[#1A1A1A]/80 border-gray-600/30"
                    : isCorrectToday
                      ? "bg-green-500/8 border border-green-500/20"
                      : "bg-red-500/8 border border-red-500/20"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg flex-shrink-0 text-white ${
                    isCorrectToday === null ? "bg-gray-600" : isCorrectToday ? "bg-green-500" : "bg-red-500"
                  }`}
                >
                  {isCorrectToday === null ? "?" : isCorrectToday ? "O" : "X"}
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">내 예측</p>
                  <p className="text-base font-black text-white">
                    {todayEntry?.kospi_answer ? "상승" : "하락"} 예측 ·{" "}
                    {isCorrectToday === null ? "판정 대기" : isCorrectToday ? "정답!" : "오답"}
                  </p>
                </div>
              </div>

              {/* 스탯 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl px-4 py-3">
                  <p className="text-[10px] text-gray-600 mb-1">누적 적중률</p>
                  <p className="text-2xl font-black text-white">
                    {dash?.accuracy?.kospi != null ? `${dash.accuracy.kospi}%` : "—"}
                  </p>
                </div>
                <div className={`rounded-2xl px-4 py-3 ${streak > 1 ? "bg-orange-500/10 border border-orange-500/25" : "bg-[#1A1A1A] border border-[#2A2A2A]"}`}>
                  <p className="text-[10px] text-gray-600 mb-1">연속 적중</p>
                  <p className={`text-2xl font-black ${streak > 1 ? "text-orange-400" : "text-white"}`}>
                    {streak > 1 ? `${streak}일` : "—"}
                  </p>
                </div>
              </div>

              {/* 버튼 */}
              <div className="pt-1 space-y-2">
                {(() => {
                  const shareUrl = typeof window !== "undefined" ? window.location.origin : "https://kospi.vercel.app";
                  const direction =
                    typeof resolvedMarketFromMe === "boolean" ? (resolvedMarketFromMe ? "상승" : "하락") : "판정중";
                  const pctText = today.kospi_change_pct != null
                    ? ` ${today.kospi_change_pct >= 0 ? "+" : ""}${today.kospi_change_pct.toFixed(2)}%`
                    : "";
                  const streakText = streak > 1 ? ` | ${streak}일 연속 적중` : "";
                  const accuracyText = dash?.accuracy?.kospi != null ? ` | 적중률 ${dash.accuracy.kospi}%` : "";
                  const verdictLine =
                    isCorrectToday === null ? "" : `${isCorrectToday ? " ✅ 맞췄어요!" : " ❌ 틀렸어요"}`;
                  const shareText = `코스피 ${direction}${pctText}${verdictLine}${streakText}${accuracyText}\n\n코스피 예측에 참여해봐요 👉`;
                  return (
                    <ShareSheet
                      url={shareUrl}
                      title="코스피 예측 결과"
                      text={shareText}
                      renderTrigger={(open) => (
                        <button
                          onClick={() => { open(); handleCloseResultCard(); }}
                          className="w-full py-4 bg-white text-gray-900 font-black rounded-2xl text-sm active:scale-95 transition-all"
                        >
                          친구에게 자랑하기
                        </button>
                      )}
                    />
                  );
                })()}
                <button
                  onClick={handleCloseResultCard}
                  className="w-full py-2.5 text-gray-600 text-sm hover:text-gray-400 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 대결 신청 토스트 ── */}
      {challengeToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[90vw] max-w-sm bg-[#1E1E1E] border border-[#333] rounded-2xl px-4 py-3 text-sm text-white shadow-2xl text-center animate-[fadeUp_0.3s_ease-out]">
          {challengeToast}
        </div>
      )}

      {/* ── 블러 게이트 오버레이 ── */}
      {gateType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ backdropFilter: "blur(12px)", backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-3xl p-7 w-full max-w-sm text-center space-y-5 shadow-2xl">
            {gateType === "not_connected" ? (
              <>
                <div className="text-5xl">🔔</div>
                <p className="font-black text-xl text-white">알림 연동이 필요해요</p>
                <p className="text-sm text-gray-400 leading-relaxed">
                  텔레그램 또는 브라우저 알림을 연결해야<br />대시보드를 볼 수 있어요.
                </p>
                <button
                  onClick={() => router.push("/setup")}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-base rounded-2xl transition-all active:scale-95"
                >
                  알림 연동하러 가기 →
                </button>
              </>
            ) : (
              <>
                <div className="text-5xl">📝</div>
                <p className="font-black text-xl text-white">오늘 설문을 해야 볼 수 있어요</p>
                <p className="text-sm text-gray-400 leading-relaxed">
                  오늘의 코스피 예측에 먼저 참여해야<br />집계 결과와 고수 예측을 확인할 수 있어요.
                </p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  설문에 참여하지 않으셨나요?<br />
                  <span className="text-gray-500">장 마감(15:35) 후에는 누구나 열람 가능합니다.</span>
                </p>
                <button
                  onClick={() => router.push("/survey")}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-white font-black text-base rounded-2xl transition-all active:scale-95"
                >
                  설문하러 가기 →
                </button>
              </>
            )}
            <button
              onClick={handleLogout}
              className="block w-full text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      )}
      {/* 헤더 */}
      <div className="pt-8 pb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">
            {(() => {
              const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
              const mm = String(kst.getMonth() + 1).padStart(2, "0");
              const dd = String(kst.getDate()).padStart(2, "0");
              const dateStr = `${mm}/${dd}`;
              if (status === "no_survey") {
                const day = kst.getDay(); // 0=일, 6=토
                const mins = kst.getHours() * 60 + kst.getMinutes();
                const isWeekend = day === 0 || day === 6;
                const isPreSurvey = mins >= 9 * 60 && mins < 22 * 60;
                if (!isWeekend && isPreSurvey) return `📊 ${dateStr} 설문 대기중`;
                return `📊 ${dateStr} 휴장일`;
              }
              return `📊 ${dateStr}`;
            })()}
          </h1>
          {user && (
            <p className="text-xs text-gray-400 mt-0.5">
              {user.name || user.email}
            </p>
          )}
        </div>
        <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          로그아웃
        </button>
      </div>

      <div className="space-y-4">
        {/* ── 오늘의 집계 ─────────────────────────────────────── */}
        <div
          className="rounded-2xl p-5 border fade-up-1"
          style={{
            borderColor: `${statusColor[status]}40`,
            backgroundColor: `${statusColor[status]}08`,
          }}
        >
          {(() => {
            const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
            const day = kst.getDay();
            const mins = kst.getHours() * 60 + kst.getMinutes();
            const isWeekend = day === 0 || day === 6;
            // 09:00~22:00 사이만 "설문 대기중", 00:00~09:00은 전날 22:00에 이미 열림
            const isPreSurvey = status === "no_survey" && !isWeekend && mins >= 9 * 60 && mins < 22 * 60;
            // 주말이면 API status 무관하게 휴장 처리 (백엔드가 잘못된 status를 반환해도 안전)
            const isHoliday = isWeekend || (status === "no_survey" && !isPreSurvey && mins >= 22 * 60);
            return (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="font-bold text-sm">
                    {isPreSurvey ? "설문 대기중" : isHoliday ? "오늘 휴장" : "오늘 코스피"}
                  </p>
                  {!isHoliday && !isPreSurvey && (
                    <span
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-bold"
                      style={{ backgroundColor: `${marketStatus.color}20`, color: marketStatus.color }}
                    >
                      {status === "open" && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: marketStatus.color }} />
                          <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: marketStatus.color }} />
                        </span>
                      )}
                      {marketStatus.label}
                    </span>
                  )}
                  {isPreSurvey && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-blue-500/20 text-blue-400">
                      설문 준비중
                    </span>
                  )}
                </div>

                {isPreSurvey && (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <span className="text-4xl">⏳</span>
                    <p className="text-white font-bold">오늘 설문이 곧 열려요</p>
                    <p className="text-sm text-gray-400">밤 22:00에 알림이 발송됩니다</p>
                  </div>
                )}

                {isHoliday && (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <span className="text-4xl">🏖️</span>
                    <p className="text-white font-bold">오늘은 장이 열리지 않아요</p>
                    <p className="text-sm text-gray-400">주말·공휴일엔 설문이 발송되지 않습니다</p>
                  </div>
                )}
              </>
            );
          })()}

          {(status === "open" || status === "closed" || status === "result") && !isWeekendKST && today && (() => {
            const myEntry = dash?.history?.find((h) => sameSurveyDate(h.date, today.survey_date));
            const myPickVerdict = userPickVerdictFromTodayAndHistory(today, myEntry);
            const effectiveMarketDir = resolvedMarketDirection(today, myEntry);
            return (
              <>
              <div className="grid grid-cols-4 gap-1.5">
                {/* 고수예측 */}
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl py-3 px-1 flex flex-col items-center gap-1 text-center">
                  <p className="text-[10px] text-yellow-400/80 leading-tight">⭐고수</p>
                  {today.kospi_weighted_pct !== null ? (
                    <>
                      <p className={`text-xs font-black ${today.kospi_weighted_pct >= 50 ? "text-green-400" : "text-red-400"}`}>
                        {today.kospi_weighted_pct >= 50 ? "📈상승" : "📉하락"}
                      </p>
                      <p className="text-[10px] text-gray-400">{today.kospi_weighted_pct}%</p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500">-</p>
                  )}
                </div>

                {/* 단순통계 */}
                <div className="bg-[#111] border border-[#2A2A2A] rounded-xl py-3 px-1 flex flex-col items-center gap-1 text-center">
                  <p className="text-[10px] text-gray-500 leading-tight">단순</p>
                  {today.kospi_yes_pct !== null ? (
                    <>
                      <p className={`text-xs font-black ${today.kospi_yes_pct >= 50 ? "text-green-400" : "text-red-400"}`}>
                        {today.kospi_yes_pct >= 50 ? "📈상승" : "📉하락"}
                      </p>
                      <p className="text-[10px] text-gray-400">{today.kospi_yes_pct}%</p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500">-</p>
                  )}
                </div>

                {/* 내 선택 */}
                <div className="bg-[#111] border border-[#2A2A2A] rounded-xl py-3 px-1 flex flex-col items-center gap-1 text-center">
                  <p className="text-[10px] text-gray-500 leading-tight">내선택</p>
                  {myEntry ? (
                    <>
                      <p className={`text-xs font-black ${myEntry.kospi_answer ? "text-green-400" : "text-red-400"}`}>
                        {myEntry.kospi_answer ? "📈상승" : "📉하락"}
                      </p>
                      <p className="text-[10px]">
                        {myPickVerdict === null
                          ? "대기중"
                          : myPickVerdict
                            ? "✅맞음"
                            : "❌틀림"}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500">미참여</p>
                  )}
                </div>

                {/* 실적 */}
                <div className="bg-[#111] border border-[#2A2A2A] rounded-xl py-3 px-1 flex flex-col items-center gap-1 text-center">
                  <p className="text-[10px] text-gray-500 leading-tight">실적</p>
                  {effectiveMarketDir !== null ? (
                    <>
                      <p className={`text-xs font-black ${effectiveMarketDir ? "text-green-400" : "text-red-400"}`}>
                        {effectiveMarketDir ? "📈상승" : "📉하락"}
                      </p>
                      <p
                        className={`text-[10px] ${today.kospi_change_pct == null ? "text-gray-500" : today.kospi_change_pct >= 0 ? "text-green-400/70" : "text-red-400/70"}`}
                      >
                        {today.kospi_change_pct == null ? "변동율 확인중" : `${today.kospi_change_pct >= 0 ? "+" : ""}${today.kospi_change_pct.toFixed(2)}%`}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500">장마감전</p>
                  )}
                </div>
              </div>

              {/* 📊 집단 예측 VS (상승 vs 하락) */}
              {today.kospi_yes_pct !== null && (() => {
                const up = today.kospi_yes_pct;
                const dn = Math.max(0, Math.min(100, 100 - up));
                return (
                  <div className="mt-4 space-y-2">
                    <p className="text-center text-[11px] font-bold text-gray-400 tracking-wide">집단 예측</p>
                    <div className="flex items-stretch gap-2 min-h-[100px]">
                      <div
                        className={`flex-1 flex flex-col items-center justify-center rounded-2xl border-2 px-2 py-3 ${
                          up >= dn
                            ? "border-green-500/50 bg-gradient-to-b from-green-500/15 to-green-900/10"
                            : "border-green-600/25 bg-green-950/20"
                        }`}
                      >
                        <span className="text-2xl mb-1">📈</span>
                        <span className="text-[10px] font-black text-green-400/90 uppercase tracking-tighter">상승</span>
                        <span className="text-2xl font-black text-green-400 tabular-nums leading-tight">{up}<span className="text-sm">%</span></span>
                      </div>
                      <div className="flex flex-col items-center justify-center px-1 shrink-0">
                        <span className="text-lg font-black text-white/90 italic tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]">
                          VS
                        </span>
                        <span className="text-[9px] text-gray-600 mt-0.5 whitespace-nowrap">대결</span>
                      </div>
                      <div
                        className={`flex-1 flex flex-col items-center justify-center rounded-2xl border-2 px-2 py-3 ${
                          dn > up
                            ? "border-red-500/50 bg-gradient-to-b from-red-500/15 to-red-900/10"
                            : "border-red-600/25 bg-red-950/20"
                        }`}
                      >
                        <span className="text-2xl mb-1">📉</span>
                        <span className="text-[10px] font-black text-red-400/90 uppercase tracking-tighter">하락</span>
                        <span className="text-2xl font-black text-red-400 tabular-nums leading-tight">{dn}<span className="text-sm">%</span></span>
                      </div>
                    </div>
                  </div>
                );
              })()}
              </>
            );
          })()}
        </div>

        {/* ── 내 통계 + 예측 이력 ──────────────────────────── */}
        <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A] fade-up-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <p className="font-bold text-sm">내 통계</p>
              {/* 결과 공유카드 재호출 버튼 */}
              {today?.status === "result" && isCorrectToday !== null && (
                <button
                  onClick={() => setShowResultCard(true)}
                  className="text-[10px] text-gray-500 hover:text-white border border-[#333] hover:border-[#555] px-2 py-0.5 rounded-full transition-colors"
                >
                  결과 공유
                </button>
              )}
            </div>
            {streak >= 2 && (
              <span className="flex items-center gap-1 text-xs font-black text-orange-400 bg-orange-400/10 border border-orange-400/30 px-2.5 py-1 rounded-full fire-glow badge-pop">
                🔥 {streak}연속 적중
              </span>
            )}
            {streak === 1 && (
              <span className="flex items-center gap-1 text-xs font-bold text-orange-300/70 bg-orange-400/5 px-2 py-0.5 rounded-full badge-pop">
                🔥 1연속 적중
              </span>
            )}
          </div>

          {dash && dash.total_predictions === 0 ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-3xl">📭</p>
              <p className="text-sm text-gray-400">
                아직 예측 이력이 없어요.<br />
                설문에 응답해보세요!
              </p>
            </div>
          ) : dash ? (
            <div className="space-y-4">
              {/* 적중률 숫자 */}
              <div className="flex items-end gap-2">
                <p className="text-5xl font-black text-green-400 leading-none count-pop tabular-nums">
                  {dash.accuracy.kospi != null ? `${dash.accuracy.kospi}` : "-"}
                </p>
                {dash.accuracy.kospi != null && (
                  <p className="text-xl font-black text-green-400/70 pb-0.5">%</p>
                )}
                <p className="text-xs text-gray-500 pb-1 ml-1">적중률 · {dash.total_predictions}일 참여</p>
              </div>

              {/* 토큰 + 스트릭 */}
              {dash.tokens != null && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3">
                    <p className="text-[10px] text-gray-500 mb-1">보유 토큰</p>
                    <p className="text-xl font-black text-yellow-400 tabular-nums">
                      💰 {dash.tokens.toLocaleString()}
                    </p>
                  </div>
                  <div className={`rounded-xl px-4 py-3 border ${
                    streak >= 5
                      ? "bg-yellow-500/10 border-yellow-500/30"
                      : streak >= 3
                        ? "bg-orange-500/10 border-orange-500/30"
                        : "bg-[#1A1A1A] border-[#2A2A2A]"
                  }`}>
                    <p className="text-[10px] text-gray-500 mb-1">연속 적중</p>
                    <p className={`text-xl font-black tabular-nums ${
                      streak >= 5 ? "text-yellow-400" :
                      streak >= 3 ? "text-orange-400" : "text-white"
                    }`}>
                      {streak >= 5 ? "🏆 " : streak >= 3 ? "🔥 " : ""}
                      {streak}일
                    </p>
                    <p className="text-[9px] text-gray-600 mt-1 leading-snug">
                      예측 이력 기준 (배팅 배율과 별개)
                    </p>
                  </div>
                </div>
              )}

              {/* 최근 이력 */}
              {dash.history.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-500">최근 이력 (화면에는 최대 5거래일)</p>
                  {dash.history.slice(0, 5).map((item) => (
                    <HistoryRow key={item.date} item={item} />
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <CrowdGaugeBoxplotsSection />

        {today?.participants && today.participants.length > 0 && (() => {
          const myEntry = dash?.history?.find((h) => sameSurveyDate(h.date, today.survey_date));
          const myAcc   = dash?.accuracy?.kospi;

          // 적중률 내림차순 정렬 (null은 맨 뒤)
          const sorted = [...today.participants].sort((a, b) => {
            if (a.accuracy === null && b.accuracy === null) return 0;
            if (a.accuracy === null) return 1;
            if (b.accuracy === null) return -1;
            return b.accuracy - a.accuracy;
          });

          // 내 행 찾기: 예측 + 적중률 일치
          const myIdx = sorted.findIndex(
            (p) => p.accuracy === myAcc && p.kospi_answer === myEntry?.kospi_answer
          );

          const medals = ["🥇", "🥈", "🥉"];
          const tooFew = sorted.length < 5;

          return (
            <div className="bg-[#1A1A1A] rounded-2xl border border-[#2A2A2A] fade-up-5 overflow-hidden">
              {/* 헤더 */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div>
                  <p className="font-black text-sm text-white">🏆 전국대결</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">적중률 기준 순위</p>
                </div>
                {!tooFew && <span className="text-xs text-gray-500 bg-[#252525] px-2.5 py-1 rounded-full">
                  {sorted.length}명 참여
                </span>}
              </div>

              {/* 참여자 부족 시 블러 준비중 오버레이 */}
              {tooFew && (
                <div className="relative px-5 pb-5 overflow-hidden">
                  {/* 블러 배경 (가짜 순위 실루엣) */}
                  <div className="blur-sm pointer-events-none select-none space-y-2 py-2">
                    {["한**", "이**", "박**", "김**"].map((name, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] text-gray-400 px-1">
                        <span>{medals[i] ?? `${i+1}`} {name}</span>
                        <span className="text-gray-500">상승 · 67%</span>
                      </div>
                    ))}
                  </div>
                  {/* 오버레이 */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-b-2xl gap-2">
                    <p className="text-lg">🔒</p>
                    <p className="text-sm font-black text-white">전국대결 준비중</p>
                    <p className="text-[11px] text-gray-400">참여자가 모이면 자동으로 열려요</p>
                    <button
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({
                            title: "주식장 직전 8:48, 코스피 예측",
                            text: "투자 잘하거나 못하는 친구가 있나요? 같이 코스피 예측해봐요!",
                            url: window.location.origin,
                          });
                        } else {
                          navigator.clipboard.writeText(window.location.origin);
                          alert("링크가 복사됐어요!");
                        }
                      }}
                      className="mt-1 bg-yellow-500 hover:bg-yellow-400 text-black text-[11px] font-black px-4 py-1.5 rounded-full transition-colors"
                    >
                      친구 초대하기 🔗
                    </button>
                  </div>
                </div>
              )}

              {/* 1·2·3위 포디움 */}
              {!tooFew && sorted.length >= 2 && (
                <div className="flex items-end justify-center gap-2 px-5 pb-4">
                  {/* 시각적 순서: 2위(left) → 1위(center) → 3위(right) */}
                  {[1, 0, 2].map((rankIdx) => {
                    const p = sorted[rankIdx];
                    if (!p) return <div key={rankIdx} className="flex-1" />;
                    const isMe = rankIdx === myIdx;
                    // rankIdx 0=1위, 1=2위, 2=3위 — 직접 매핑
                    const heights      = ["h-24", "h-20", "h-16"];
                    const borderColors = ["border-yellow-400/50", "border-gray-300/30", "border-amber-600/40"];
                    const podiumH = heights[rankIdx];
                    const bc      = borderColors[rankIdx];
                    return (
                      <div key={rankIdx} className="flex-1 flex flex-col items-center gap-1">
                        {isMe && <span className="text-[9px] text-blue-400 font-bold">나</span>}
                        <span className="text-lg">{medals[rankIdx]}</span>
                        <p className="text-[10px] text-gray-300 font-bold truncate max-w-full px-1">{p.masked_name}</p>
                        <div className={`w-full ${podiumH} rounded-t-lg border ${bc} flex items-end justify-center pb-2 ${
                          isMe ? "bg-blue-500/20" : "bg-[#252525]"
                        }`}>
                          <span className="text-xs font-black text-white">
                            {p.accuracy !== null ? `${p.accuracy}%` : "신규"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

                {/* Top 5 순위 리스트 */}
              {!tooFew && <div className="border-t border-[#2A2A2A]">
                <div className="grid grid-cols-[28px_1fr_56px_44px_60px] text-[10px] text-gray-600 px-4 py-2">
                  <span>#</span><span>닉네임</span><span className="text-center">예측</span><span className="text-right">적중률</span><span></span>
                </div>
                <div className="divide-y divide-[#222]">
                  {sorted.slice(0, 5).map((p, i) => {
                    const isMe = i === myIdx;
                    const mk = resolvedMarketDirection(today, todayEntry ?? undefined);
                    const result =
                      typeof mk === "boolean" ? (p.kospi_answer === mk ? "✅" : "❌") : null;
                    const alreadyChallenged = challenges
                      ? [...challenges.sent, ...challenges.received].some(
                          (c) => c.opponent_id === p.user_id
                        )
                      : false;
                    return (
                      <div
                        key={i}
                        className={`grid grid-cols-[28px_1fr_56px_44px_60px] items-center px-4 py-3 transition-colors ${
                          isMe ? "bg-blue-500/10 border-l-2 border-blue-500" : ""
                        }`}
                      >
                        {/* 순위 */}
                        <span className="text-sm">
                          {i < 3 ? medals[i] : <span className="text-gray-500 text-xs">{i + 1}</span>}
                        </span>
                        {/* 이름 */}
                        <span className="text-sm font-bold text-white flex items-center gap-1.5 truncate">
                          {p.masked_name}
                          {isMe && (
                            <span className="text-[9px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-black flex-shrink-0">나</span>
                          )}
                        </span>
                        {/* 예측 + 결과 */}
                        <span className={`text-[11px] font-bold text-center flex items-center justify-center gap-0.5 ${
                          p.kospi_answer ? "text-green-400" : "text-red-400"
                        }`}>
                          {p.kospi_answer ? "📈" : "📉"}
                          {result && <span className="text-xs">{result}</span>}
                        </span>
                        {/* 적중률 */}
                        <span className={`text-xs text-right font-bold ${
                          i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-gray-400"
                        }`}>
                          {p.accuracy !== null ? `${p.accuracy}%` : "신규"}
                        </span>
                        {/* 대결 버튼 */}
                        <div className="flex justify-end">
                          {!isMe && (
                            alreadyChallenged ? (
                              <span className="text-[10px] text-gray-600 font-bold">신청됨</span>
                            ) : (
                              <button
                                onClick={() => p.user_id && handleChallenge(p.user_id, today.survey_date)}
                                disabled={challengeLoading === p.user_id || !p.user_id}
                                className="text-[10px] font-black px-2 py-1 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/40 active:scale-95 transition-all disabled:opacity-40 whitespace-nowrap"
                              >
                                {challengeLoading === p.user_id ? "..." : "⚔️ 대결"}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>}

              {/* 내가 Top5 밖일 때 내 위치 표시 */}
              {!tooFew && myIdx >= 5 && (() => {
                const me = sorted[myIdx];
                return (
                  <div className="border-t border-[#2A2A2A]">
                    <div className="grid grid-cols-[28px_1fr_56px_44px_60px] items-center px-4 py-3 bg-blue-500/10 border-l-2 border-blue-500">
                      <span className="text-gray-500 text-xs">{myIdx + 1}</span>
                      <span className="text-sm font-bold text-white flex items-center gap-1.5">
                        {me.masked_name}
                        <span className="text-[9px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-black">나</span>
                      </span>
                      <span className={`text-[11px] font-bold text-center ${me.kospi_answer ? "text-green-400" : "text-red-400"}`}>
                        {me.kospi_answer ? "📈" : "📉"}
                      </span>
                      <span className="text-xs text-right font-bold text-gray-400">
                        {me.accuracy !== null ? `${me.accuracy}%` : "신규"}
                      </span>
                      <div />
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* ── 내 대결 현황 ──────────────────────────────────── */}
        {challenges && (challenges.sent.length > 0 || challenges.received.length > 0) && (() => {
          const allChallenges = [
            ...challenges.sent,
            ...challenges.received.filter(
              (r) => !challenges.sent.some((s) => s.opponent_id === r.opponent_id)
            ),
          ];

          const REACTIONS = ["😄", "😢", "😝"] as const;

          const outcomeInfo = (c: Challenge) => {
            if (c.accepted === false) return { text: "거절됨",  color: "text-gray-600",   icon: "✖" };
            if (c.accepted === null && !c.is_sent) return { text: "수락 대기",  color: "text-orange-400", icon: "⏳" };
            if (c.accepted === null &&  c.is_sent) return { text: "수락 대기",  color: "text-gray-500",   icon: "⏳" };
            if (c.outcome === "pending")   return { text: "대결 중",  color: "text-blue-400",   icon: "⚔️" };
            if (c.outcome === "no_result") return { text: "미참여",  color: "text-gray-600",   icon: "➖" };
            if (c.outcome === "tie")       return { text: "비김",    color: "text-blue-400",   icon: "🤝" };
            const iWon = c.is_sent ? c.outcome === "challenger_wins" : c.outcome === "challenged_wins";
            return iWon
              ? { text: "승리!", color: "text-yellow-400", icon: "🏆" }
              : { text: "패배", color: "text-red-400",    icon: "😢" };
          };

          return (
            <div className="bg-[#1A1A1A] rounded-2xl border border-[#2A2A2A] overflow-hidden fade-up-5">
              <div className="px-5 pt-4 pb-3 flex items-center justify-between">
                <p className="font-black text-sm text-white">⚔️ 내 대결 현황</p>
                <span className="text-[10px] text-gray-500 bg-[#252525] px-2 py-0.5 rounded-full">
                  {allChallenges.length}건
                </span>
              </div>

              <div className="divide-y divide-[#222] border-t border-[#2A2A2A]">
                {allChallenges.map((c) => {
                  const { text, color, icon } = outcomeInfo(c);
                  const isDone = c.outcome !== "pending" && c.outcome !== "no_result";
                  const isPickerOpen = reactingId === c.id;

                  return (
                    <div key={c.id} className="px-5 py-4 space-y-3">
                      {/* 상단: 상대 이름 + 결과 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{c.opponent_masked_name}</span>
                          <span className="text-[10px] text-gray-600">
                            {c.is_sent ? "내가 신청" : "받은 신청"}
                          </span>
                        </div>
                        <span className={`text-sm font-black flex items-center gap-1 ${color}`}>
                          <span>{icon}</span><span>{text}</span>
                        </span>
                      </div>

                      {/* 수락/거절 버튼 — 받은 신청이고 아직 미처리 */}
                      {!c.is_sent && c.accepted === null && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAccept(c.id)}
                            disabled={acceptLoading === c.id}
                            className="flex-1 py-2.5 bg-green-500 hover:bg-green-400 active:scale-95 text-white text-xs font-black rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                          >
                            {acceptLoading === c.id
                              ? <span className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />
                              : "✅"}
                            수락
                          </button>
                          <button
                            onClick={() => handleDecline(c.id)}
                            disabled={acceptLoading === c.id}
                            className="flex-1 py-2.5 bg-[#252525] hover:bg-[#2A2A2A] border border-[#333] active:scale-95 text-gray-400 hover:text-white text-xs font-black rounded-xl transition-all"
                          >
                            거절
                          </button>
                        </div>
                      )}

                      {/* 수락 후 전용 그룹 배지 */}
                      {c.accepted === true && c.duel_group_id && (
                        <button
                          onClick={() => router.push("/groups")}
                          className="flex items-center gap-1.5 text-[11px] text-blue-400/80 hover:text-blue-400 transition-colors"
                        >
                          <span>👥</span>
                          <span>전용 대결 그룹 보기 →</span>
                        </button>
                      )}

                      {/* 반응 영역 */}
                      {isDone && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* 상대방 반응 표시 */}
                          {c.opp_reaction && (
                            <div className="flex items-center gap-1 bg-[#252525] rounded-full px-2.5 py-1">
                              <span className="text-sm">{c.opp_reaction}</span>
                              <span className="text-[10px] text-gray-500">상대</span>
                            </div>
                          )}

                          {/* 내 반응 or 피커 */}
                          {c.my_reaction ? (
                            <div className="flex items-center gap-1 bg-blue-500/20 border border-blue-500/30 rounded-full px-2.5 py-1">
                              <span className="text-sm">{c.my_reaction}</span>
                              <span className="text-[10px] text-blue-400">나</span>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => setReactingId(isPickerOpen ? null : c.id)}
                                className="text-[11px] text-gray-400 bg-[#252525] hover:bg-[#2A2A2A] border border-[#333] rounded-full px-2.5 py-1 transition-colors"
                              >
                                {isPickerOpen ? "닫기" : "😄 반응하기"}
                              </button>
                              {isPickerOpen && (
                                <div className="flex gap-1.5 animate-[fadeUp_0.2s_ease-out]">
                                  {REACTIONS.map((r) => (
                                    <button
                                      key={r}
                                      onClick={() => handleReact(c.id, r, c.survey_date)}
                                      className="w-9 h-9 text-xl bg-[#252525] hover:bg-orange-500/20 border border-[#333] hover:border-orange-500/40 rounded-xl transition-all active:scale-90 flex items-center justify-center"
                                    >
                                      {r}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}

                          {/* 재대결 버튼 */}
                          <button
                            onClick={() => handleRematch(c.id, c.survey_date)}
                            disabled={rematchLoading === c.id}
                            className="ml-auto text-[11px] font-black px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/30 active:scale-95 transition-all disabled:opacity-40 whitespace-nowrap"
                          >
                            {rematchLoading === c.id ? "..." : "🔥 재대결"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── 아이템 섹션 · 잠금 해제 후 열람 ── */}
        {token && (
          <Suspense fallback={<DashboardInsightSectionSkeleton />}>
            <DashboardInsightSection
              accessToken={token}
              onBalanceUpdated={() => void refreshDashboard()}
            />
          </Suspense>
        )}

      </div>
      </div>
      <AppTabNav />
    </main>
  );
}
