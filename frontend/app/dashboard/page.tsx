"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMe, getToday, getDashboard, UserProfile, TodaySurvey, DashboardData } from "@/lib/api";

function HistoryRow({ item }: { item: DashboardData["history"][0] }) {
  const hasResult = item.kospi_correct !== null;
  return (
    <div className="flex items-center gap-3 bg-[#1A1A1A] rounded-xl px-4 py-3 border border-[#2A2A2A]">
      <p className="text-xs text-gray-500 w-20 flex-shrink-0">{item.date.slice(5)}</p>

      <div className="flex gap-4 flex-1 text-xs">
        <div className="text-center">
          <p className="text-gray-500 mb-0.5">코스피</p>
          <p className={item.kospi_answer ? "text-green-400" : "text-red-400"}>
            {item.kospi_answer ? "📈 오름" : "📉 내림"}
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

  return (
    <main className="max-w-md mx-auto min-h-screen pb-36 px-5 relative">
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
        {/* ── 오늘의 집계 ─────────────────────────────────── */}
        <div
          className="rounded-2xl p-5 border"
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
                    {isPreSurvey ? "설문 대기중" : isHoliday ? "오늘 휴장" : "실적 / 전망"}
                  </p>
                  {!isHoliday && !isPreSurvey && (
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-bold"
                      style={{ backgroundColor: `${marketStatus.color}20`, color: marketStatus.color }}
                    >
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

          {(status === "open" || status === "closed" || status === "result") && today && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 text-right">
                총 <span className="text-white font-bold">{today.total_responses}명</span> 참여
              </p>

              {/* 고수예측 / 단순통계 / 실적 — 3열 카드 */}
              <div className="grid grid-cols-3 gap-2">
                {/* 고수 강화예측 */}
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 flex flex-col items-center gap-1 text-center">
                  <p className="text-xs text-yellow-400/80">⭐ 고수예측</p>
                  {today.kospi_weighted_pct !== null ? (
                    <>
                      <p className={`text-sm font-black ${today.kospi_weighted_pct >= 50 ? "text-green-400" : "text-red-400"}`}>
                        {today.kospi_weighted_pct >= 50 ? "📈 상승" : "📉 하락"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {today.kospi_weighted_pct}% 상승론
                      </p>
                    </>
                  ) : (
                    <p className="text-xs font-bold text-gray-500">-</p>
                  )}
                </div>

                {/* 단순통계 */}
                <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-3 flex flex-col items-center gap-1 text-center">
                  <p className="text-xs text-gray-500">단순통계</p>
                  {today.kospi_yes_pct !== null ? (
                    <>
                      <p className={`text-sm font-black ${today.kospi_yes_pct >= 50 ? "text-green-400" : "text-red-400"}`}>
                        {today.kospi_yes_pct >= 50 ? "📈 상승" : "📉 하락"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {today.kospi_yes_pct}% 상승론
                      </p>
                    </>
                  ) : (
                    <p className="text-xs font-bold text-gray-500">-</p>
                  )}
                </div>

                {/* 실적 */}
                <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-3 flex flex-col items-center gap-1 text-center">
                  <p className="text-xs text-gray-500">실적</p>
                  {today.kospi_result !== null && today.kospi_change_pct !== null ? (
                    <>
                      <p className={`text-sm font-black ${today.kospi_result ? "text-green-400" : "text-red-400"}`}>
                        {today.kospi_result ? "📈 상승" : "📉 하락"}
                      </p>
                      <p className={`text-xs ${today.kospi_change_pct >= 0 ? "text-green-400/70" : "text-red-400/70"}`}>
                        {today.kospi_change_pct >= 0 ? "+" : ""}{today.kospi_change_pct.toFixed(2)}%
                      </p>
                    </>
                  ) : (
                    <p className="text-xs font-bold text-gray-500">장마감전</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>


        {/* ── 고수 vs 하수 예측 ────────────────────────────── */}
        {(today?.top_predictor || today?.worst_predictor) && (
          <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A]">
            <p className="font-bold text-sm mb-4">오늘의 예측</p>
            <div className="grid grid-cols-2 gap-3">
              {/* 맞춤 고수 */}
              {today.top_predictor && (
                <div className="bg-[#111] border border-yellow-500/20 rounded-2xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-1">
                    <span>👑</span>
                    <span className="text-xs text-yellow-400 font-bold truncate">맞춤 고수</span>
                  </div>
                  <p className="text-white font-bold text-sm truncate">{today.top_predictor.masked_name}</p>
                  <p className="text-xs text-gray-500">{today.top_predictor.accuracy}% · {today.top_predictor.total_predictions}일</p>
                  <div className="border-t border-[#2A2A2A] pt-2">
                    <p className="text-xs text-gray-500 mb-1">코스피</p>
                    <p className={`text-xs font-bold ${today.top_predictor.kospi_answer ? "text-green-400" : "text-red-400"}`}>
                      {today.top_predictor.kospi_answer ? "📈 오른다" : "📉 내린다"}
                    </p>
                  </div>
                </div>
              )}
              {/* 빗나간 예측 */}
              {today.worst_predictor && (
                <div className="bg-[#111] border border-blue-500/20 rounded-2xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-1">
                    <span>🤡</span>
                    <span className="text-xs text-blue-400 font-bold truncate">못맞춤 고수</span>
                  </div>
                  <p className="text-white font-bold text-sm truncate">{today.worst_predictor.masked_name}</p>
                  <p className="text-xs text-gray-500">{today.worst_predictor.accuracy}% · {today.worst_predictor.total_predictions}일</p>
                  <div className="border-t border-[#2A2A2A] pt-2">
                    <p className="text-xs text-gray-500 mb-1">코스피</p>
                    <p className={`text-xs font-bold ${today.worst_predictor.kospi_answer ? "text-green-400" : "text-red-400"}`}>
                      {today.worst_predictor.kospi_answer ? "📈 오른다" : "📉 내린다"}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-600 text-center mt-3">못맞춤 고수 예측은 반대 신호로 활용하세요 😏</p>
          </div>
        )}

        {/* ── 내 통계 ──────────────────────────────────────── */}
        <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A]">
          <p className="font-bold text-sm mb-4">내 통계</p>

          {/* 오늘 내 선택 — 항상 표시 */}
          {(() => {
            const todayEntry = dash?.history?.find((h) => h.date === today?.survey_date);
            const hasResult = today?.kospi_result != null;
            const isCorrect = todayEntry && hasResult
              ? todayEntry.kospi_answer === today?.kospi_result
              : null;
            return (
              <div className="mb-4 pb-4 border-b border-[#2A2A2A]">
                <p className="text-xs text-gray-500 mb-2">오늘 내 선택</p>
                {todayEntry ? (
                  <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${
                    isCorrect === true ? "bg-green-500/10 border border-green-500/30" :
                    isCorrect === false ? "bg-red-500/10 border border-red-500/20" :
                    "bg-[#111]"
                  }`}>
                    <p className={`font-bold text-sm ${todayEntry.kospi_answer ? "text-green-400" : "text-blue-400"}`}>
                      {todayEntry.kospi_answer ? "📈 코스피 오른다" : "📉 코스피 내린다"}
                    </p>
                    {isCorrect === true && <span className="text-lg">✅</span>}
                    {isCorrect === false && <span className="text-lg">❌</span>}
                    {isCorrect === null && <span className="text-xs text-gray-500">결과 대기중</span>}
                  </div>
                ) : (
                  <div className="bg-[#111] rounded-xl px-4 py-3 flex items-center justify-between">
                    <p className="text-sm text-gray-500">오늘 미참여</p>
                    <button
                      onClick={() => router.push("/survey")}
                      className="text-xs text-amber-400 font-bold"
                    >
                      참여하기 →
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

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
              {/* 코스피 적중률 — 맨 위 */}
              <div className="bg-[#111] rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">코스피 적중률</p>
                <p className="text-2xl font-black text-green-400">
                  {dash.accuracy.kospi != null ? `${dash.accuracy.kospi}%` : "-"}
                </p>
                <p className="text-xs text-gray-500 mt-1">{dash.total_predictions}일 참여</p>
              </div>

              {/* 전체 정확도 + 순위 + 기여도 */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "#1F2937" }}>
                  <p className="text-xs text-gray-400 mb-1 whitespace-nowrap">정확도</p>
                  <p className="text-2xl font-black text-blue-400">
                    {dash.accuracy.overall != null ? `${dash.accuracy.overall}%` : "-"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">전체</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "#1F2937" }}>
                  <p className="text-xs text-gray-400 mb-1 whitespace-nowrap">내 순위</p>
                  <p className="text-xl font-black text-yellow-400">
                    {dash.percentile !== null ? `상위${dash.percentile}%` : "-"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">전체 대비</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "#1F2937" }}>
                  <p className="text-xs text-gray-400 mb-1 whitespace-nowrap">기여도</p>
                  <p className={`text-2xl font-black ${
                    dash.contribution != null
                      ? dash.contribution >= 100 ? "text-green-400" : "text-orange-400"
                      : "text-gray-500"
                  }`}>
                    {dash.contribution != null ? `${dash.contribution}%` : "-"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">평균 대비</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* ── 예측 이력 ────────────────────────────────────── */}
        {dash && dash.history.length > 0 && (
          <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A]">
            <p className="font-bold text-sm mb-3">
              최근 예측 이력
              <span className="text-gray-500 text-xs font-normal ml-2">
                ✅ 맞음 / ❌ 틀림
              </span>
            </p>
            <div className="space-y-2">
              {dash.history.map((item) => (
                <HistoryRow key={item.date} item={item} />
              ))}
            </div>
          </div>
        )}
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
