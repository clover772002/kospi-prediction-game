"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMe, getToday, getDashboard, UserProfile, TodaySurvey, DashboardData } from "@/lib/api";

// 연속 적중 스트릭 계산
function calcStreak(history: DashboardData["history"]): number {
  const withResult = [...history].filter((h) => h.kospi_correct !== null);
  let count = 0;
  for (const item of withResult) {
    if (item.kospi_correct === true) count++;
    else break;
  }
  return count;
}

function HistoryRow({ item }: { item: DashboardData["history"][0] }) {
  const hasResult = item.kospi_correct !== null;
  return (
    <div className="flex items-center gap-3 bg-[#1A1A1A] rounded-xl px-4 py-3 border border-[#2A2A2A]">
      <p className="text-xs text-gray-500 w-20 flex-shrink-0">{item.date.slice(5)}</p>

      <div className="flex gap-4 flex-1 text-xs">
        <div className="text-center">
          <p className="text-gray-500 mb-0.5">코스피</p>
          <p className={item.kospi_answer ? "text-green-400" : "text-red-400"}>
            {item.kospi_answer ? "📈 상승" : "📉 하락"}
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-shrink-0 text-sm">
        {hasResult ? (
          <span title="코스피">{item.kospi_correct ? "✅" : "❌"}</span>
        ) : (
          <span className="text-xs text-gray-600">결과 대기</span>
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

  useEffect(() => {
    let called = false;

    const loadData = async (accessToken: string) => {
      if (called) return;
      called = true;
      setToken(accessToken);
      try {
        // 각 요청에 8초 타임아웃 적용
        const withTimeout = <T,>(p: Promise<T>, ms = 8000): Promise<T> =>
          Promise.race([
            p,
            new Promise<T>((_, reject) =>
              setTimeout(() => reject(new Error(`요청 타임아웃 (${ms / 1000}초). 백엔드(localhost:8000)가 실행 중인지 확인해주세요.`)), ms)
            ),
          ]);

        const [profile, todayData, dashData] = await Promise.all([
          withTimeout(getMe(accessToken)),
          withTimeout(getToday()),
          withTimeout(getDashboard(accessToken)),
        ]);
        setUser(profile);
        setToday(todayData);
        setDash(dashData);

        // 오늘 결과가 나왔고 참여했다면 → 결과 카드 팝업 (하루 1번)
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
        const msg = e instanceof Error ? e.message : String(e);
        console.error("데이터 로딩 오류:", msg);
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    // 1) 기존 세션 즉시 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadData(session.access_token);
    });

    // 2) OAuth 리다이렉트 후 세션 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") { router.replace("/"); return; }
      if (event === "SIGNED_IN" && session) loadData(session.access_token);
      if (event === "INITIAL_SESSION" && !session) {
        setLoading(false);
        router.replace("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (loading) {
    return (
      <main className="max-w-md mx-auto min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">데이터 불러오는 중...</p>
          <p className="text-xs text-gray-600">10초 내로 자동 해결됩니다</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-md mx-auto min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <div className="text-5xl">⚠️</div>
          <p className="font-bold text-lg">오류가 발생했습니다</p>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-left">
            <p className="text-red-400 text-sm font-mono break-all">{error}</p>
          </div>
          <p className="text-xs text-gray-500">
            백엔드(localhost:8000)가 실행 중인지,<br />
            Supabase SQL 스키마가 적용됐는지 확인해주세요.
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
  // 연동 안 됨 → 최우선 / 장마감 후는 게이트 없음
  const gateType: "not_connected" | "no_survey" | null =
    marketClosed ? null :
    !isConnected ? "not_connected" :
    surveyDay && !respondedToday ? "no_survey" :
    null;

  const statusColor: Record<string, string> = {
    no_survey: "#6B7280",
    open: "#F59E0B",
    closed: "#06B6D4",
    result: "#22C55E",
  };

  const status = today?.status ?? "no_survey";

  // 현재 시각 기준 장 상태 배너
  function getMarketStatus(): { label: string; color: string } {
    const now = new Date();
    const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const h = kst.getHours();
    const m = kst.getMinutes();
    const mins = h * 60 + m;
    if (mins < 9 * 60) return { label: "장시작전", color: "#6B7280" };
    if (mins < 15 * 60 + 30) return { label: "장중", color: "#F59E0B" };
    return { label: "장마감", color: "#22C55E" };
  }
  const marketStatus = getMarketStatus();

  // 스트릭 계산
  const streak = dash?.history ? calcStreak(dash.history) : 0;

  // 오늘 결과 공유용 데이터
  const todayEntry = dash?.history?.find((h) => h.date === today?.survey_date);
  const isCorrectToday = todayEntry && today?.kospi_result != null
    ? todayEntry.kospi_answer === today.kospi_result
    : null;

  const handleCloseResultCard = () => {
    if (today?.survey_date) {
      localStorage.setItem(`result_card_${today.survey_date}`, "1");
    }
    setShowResultCard(false);
  };

  const handleShareResult = () => {
    const streakText = streak > 1 ? ` 🔥${streak}연속 적중!` : "";
    const resultText = isCorrectToday ? "✅ 오늘 맞췄어요!" : "❌ 오늘 틀렸어요";
    const kospiText = today?.kospi_result
      ? `코스피 📈 상승 ${today?.kospi_change_pct != null ? `+${today.kospi_change_pct.toFixed(2)}%` : ""}`
      : `코스피 📉 하락 ${today?.kospi_change_pct != null ? `${today.kospi_change_pct.toFixed(2)}%` : ""}`;
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
      {/* ── 결과 공유 카드 팝업 ── */}
      {showResultCard && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-8" style={{ backgroundColor: "rgba(0,0,0,0.7)" }} onClick={handleCloseResultCard}>
          <div
            className="w-full max-w-sm rounded-3xl p-6 space-y-5 shadow-2xl slide-up"
            style={{ background: isCorrectToday ? "linear-gradient(135deg, #052e16, #14532d)" : "linear-gradient(135deg, #1c0a0a, #3b0d0d)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 결과 헤더 */}
            <div className="text-center space-y-1">
              <p className="text-4xl">{isCorrectToday ? "🎉" : "😅"}</p>
              <p className="text-xl font-black text-white">
                {isCorrectToday ? "오늘 맞췄어요!" : "오늘 틀렸어요"}
              </p>
              {streak > 1 && (
                <p className="text-sm font-bold text-orange-400">🔥 {streak}연속 적중 중!</p>
              )}
            </div>

            {/* 결과 상세 */}
            <div className="bg-black/30 rounded-2xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">오늘 코스피</span>
                <span className={`font-bold ${today?.kospi_result ? "text-green-400" : "text-red-400"}`}>
                  {today?.kospi_result ? "📈 상승" : "📉 하락"}
                  {today?.kospi_change_pct != null && ` ${today.kospi_change_pct >= 0 ? "+" : ""}${today.kospi_change_pct.toFixed(2)}%`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">내 예측</span>
                <span className={`font-bold ${todayEntry?.kospi_answer ? "text-green-400" : "text-red-400"}`}>
                  {todayEntry?.kospi_answer ? "📈 상승" : "📉 하락"}
                </span>
              </div>
              {dash?.accuracy?.kospi != null && (
                <div className="flex justify-between border-t border-white/10 pt-2">
                  <span className="text-gray-400">누적 적중률</span>
                  <span className="font-black text-white">{dash.accuracy.kospi}%</span>
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="space-y-2">
              <button
                onClick={handleShareResult}
                className="w-full py-3.5 bg-white text-gray-900 font-black rounded-2xl text-sm"
              >
                📤 친구에게 자랑하기
              </button>
              <button
                onClick={handleCloseResultCard}
                className="w-full py-2.5 text-gray-500 text-sm"
              >
                닫기
              </button>
            </div>
          </div>
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
            const isHoliday = status === "no_survey" && !isPreSurvey && (isWeekend || mins >= 22 * 60);
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

          {(status === "open" || status === "closed" || status === "result") && today && (() => {
            const myEntry = dash?.history?.find((h) => h.date === today.survey_date);
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
                        {today.kospi_result !== null
                          ? myEntry.kospi_answer === today.kospi_result ? "✅맞음" : "❌틀림"
                          : "대기중"}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500">미참여</p>
                  )}
                </div>

                {/* 실적 */}
                <div className="bg-[#111] border border-[#2A2A2A] rounded-xl py-3 px-1 flex flex-col items-center gap-1 text-center">
                  <p className="text-[10px] text-gray-500 leading-tight">실적</p>
                  {today.kospi_result !== null && today.kospi_change_pct !== null ? (
                    <>
                      <p className={`text-xs font-black ${today.kospi_result ? "text-green-400" : "text-red-400"}`}>
                        {today.kospi_result ? "📈상승" : "📉하락"}
                      </p>
                      <p className={`text-[10px] ${today.kospi_change_pct >= 0 ? "text-green-400/70" : "text-red-400/70"}`}>
                        {today.kospi_change_pct >= 0 ? "+" : ""}{today.kospi_change_pct.toFixed(2)}%
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500">장마감전</p>
                  )}
                </div>
              </div>

              {/* 📊 감성 줄다리기 바 */}
              {today.kospi_yes_pct !== null && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-green-400">📈 {today.kospi_yes_pct}%</span>
                    <span className="text-gray-500 text-[9px]">집단 예측</span>
                    <span className="text-red-400">{100 - today.kospi_yes_pct}% 📉</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden flex bg-red-500/30">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-l-full transition-all duration-1000 ease-out"
                      style={{ width: `${today.kospi_yes_pct}%` }}
                    />
                  </div>
                </div>
              )}
              </>
            );
          })()}
        </div>


        {/* ── 오늘의 예측 참여자 리스트 ────────────────────── */}
        {today?.participants && today.participants.length > 0 && (
          <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A] fade-up-3 card-hover">
            <div className="mb-3">
              <p className="font-bold text-sm">오늘의 예측</p>
            </div>
            {/* 헤더 */}
            <div className="grid grid-cols-3 text-xs text-gray-500 px-2 pb-2 border-b border-[#2A2A2A]">
              <span>닉네임</span>
              <span className="text-center">예측</span>
              <span className="text-right">적중률</span>
            </div>
            {/* 참여자 행 */}
            <div className="divide-y divide-[#2A2A2A]">
              {today.participants.map((p, i) => {
                const isTop = today.top_predictor?.masked_name === p.masked_name;
                const isWorst = today.worst_predictor?.masked_name === p.masked_name;
                return (
                  <div key={i} className="grid grid-cols-3 items-center py-2.5 px-2">
                    <span className="text-sm font-bold text-white flex items-center gap-1 truncate">
                      {isTop && <span className="text-yellow-400">👑</span>}
                      {isWorst && <span>🤡</span>}
                      {p.masked_name}
                    </span>
                    <span className={`text-xs font-bold text-center ${p.kospi_answer ? "text-green-400" : "text-red-400"}`}>
                      {p.kospi_answer ? "📈 상승" : "📉 하락"}
                    </span>
                    <span className="text-xs text-gray-400 text-right">
                      {p.accuracy !== null ? `${p.accuracy}%` : "-"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 내 통계 + 예측 이력 ──────────────────────────── */}
        <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A] fade-up-4">
          <div className="flex items-center justify-between mb-4">
            <p className="font-bold text-sm">내 통계</p>
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

              {/* 최근 이력 */}
              {dash.history.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-500">최근 이력</p>
                  {dash.history.map((item) => (
                    <HistoryRow key={item.date} item={item} />
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* 하단 내비 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-[#222] z-50">
        <div className="max-w-md mx-auto flex">
          <button
            onClick={() => router.push("/survey")}
            className="flex-1 flex flex-col items-center py-3 gap-1 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <span className="text-xl">📝</span>
            <span className="text-xs font-medium">설문</span>
          </button>
          <button className="flex-1 flex flex-col items-center py-3 gap-1 text-blue-400">
            <span className="text-xl">📊</span>
            <span className="text-xs font-bold">대시보드</span>
          </button>
          <button
            onClick={() => router.push("/setup")}
            className="flex-1 flex flex-col items-center py-3 gap-1 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <span className="text-xl">⚙️</span>
            <span className="text-xs font-medium">설정</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
