"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMe, getToday, getDashboard, UserProfile, TodaySurvey, DashboardData } from "@/lib/api";

function SentimentBar({ label, pct, result }: { label: string; pct: number | null; result?: boolean | null }) {
  const displayPct = pct ?? 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-gray-400">
        <span className="font-bold text-white">{label}</span>
        {pct !== null && (
          <span>
            오른다 <span className="text-green-400 font-bold">{pct}%</span>
            {" "}vs 내린다 <span className="text-red-400 font-bold">{100 - pct}%</span>
          </span>
        )}
      </div>
      <div className="h-3 bg-[#222] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
          style={{ width: `${displayPct}%` }}
        />
      </div>
      {result !== undefined && result !== null && (
        <p className="text-xs text-right">
          실제:{" "}
          <span className={result ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
            {result ? "▲ 상승" : "▼ 하락"}
          </span>
        </p>
      )}
    </div>
  );
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
            {item.kospi_answer ? "📈 오름" : "📉 내림"}
          </p>
        </div>
        <div className="text-center">
          <p className="text-gray-500 mb-0.5">코스닥</p>
          <p className={item.kosdaq_answer ? "text-green-400" : "text-red-400"}>
            {item.kosdaq_answer ? "📈 오름" : "📉 내림"}
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-shrink-0 text-sm">
        {hasResult ? (
          <>
            <span title="코스피">{item.kospi_correct ? "✅" : "❌"}</span>
            <span title="코스닥">{item.kosdaq_correct ? "✅" : "❌"}</span>
          </>
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
        if (!profile.telegram_chat_id && !profile.has_push) {
          router.replace("/setup");
          return;
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

  const statusLabel: Record<string, string> = {
    no_survey: "오늘은 설문 없음",
    open: "설문 진행 중 · 09:00 마감",
    closed: "집계 완료 · 결과 대기 중",
    result: "오늘 결과 공개",
  };

  const statusColor: Record<string, string> = {
    no_survey: "#6B7280",
    open: "#F59E0B",
    closed: "#06B6D4",
    result: "#22C55E",
  };

  const status = today?.status ?? "no_survey";

  return (
    <main className="max-w-md mx-auto min-h-screen pb-24 px-5">
      {/* 헤더 */}
      <div className="pt-8 pb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">📊 오늘 장 예측</h1>
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
          <div className="flex items-center justify-between mb-4">
            <p className="font-bold text-sm">오늘의 집계</p>
            <span
              className="text-xs px-2.5 py-1 rounded-full font-bold"
              style={{ backgroundColor: `${statusColor[status]}20`, color: statusColor[status] }}
            >
              {statusLabel[status]}
            </span>
          </div>

          {status === "no_survey" && (
            <p className="text-gray-500 text-sm text-center py-4">
              오늘은 설문이 없습니다. (주말·공휴일)
            </p>
          )}

          {status === "open" && (
            <div className="text-center py-4 space-y-2">
              <p className="text-3xl">⏰</p>
              <p className="font-bold">텔레그램에서 응답해주세요!</p>
              <p className="text-sm text-gray-400">09:00까지만 응답 가능합니다</p>
            </div>
          )}

          {(status === "closed" || status === "result") && today && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 text-right">
                총 <span className="text-white font-bold">{today.total_responses}명</span> 참여
              </p>

              {/* 1. 실제 실적 (결과 공개 시 최상단) */}
              {status === "result" && today.kospi_change_pct !== null && (
                <div className="flex gap-3">
                  <div className="flex-1 bg-[#111] rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">코스피 실적</p>
                    <p className={`text-lg font-black ${today.kospi_change_pct! >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {today.kospi_change_pct! >= 0 ? "+" : ""}{today.kospi_change_pct?.toFixed(2)}%
                    </p>
                    <p className="text-xs mt-0.5">{today.kospi_result ? "📈 상승" : "📉 하락"}</p>
                  </div>
                  <div className="flex-1 bg-[#111] rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">코스닥 실적</p>
                    <p className={`text-lg font-black ${today.kosdaq_change_pct! >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {today.kosdaq_change_pct! >= 0 ? "+" : ""}{today.kosdaq_change_pct?.toFixed(2)}%
                    </p>
                    <p className="text-xs mt-0.5">{today.kosdaq_result ? "📈 상승" : "📉 하락"}</p>
                  </div>
                </div>
              )}
              {status === "closed" && (
                <p className="text-xs text-gray-600 text-center">
                  실제 결과는 15:35 이후 공개됩니다
                </p>
              )}

              {/* 2. 단순 집계 */}
              <div className="space-y-3">
                <p className="text-xs text-gray-500">📊 단순 집계</p>
                <SentimentBar label="코스피" pct={today.kospi_yes_pct} />
                <SentimentBar label="코스닥" pct={today.kosdaq_yes_pct} />
              </div>

              {/* 3. 고수 가중예측 */}
              {(today.kospi_weighted_pct !== null || today.kosdaq_weighted_pct !== null) && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 space-y-3">
                  <p className="text-xs text-yellow-400 font-bold">⭐ 고수 가중예측 (누적 정확도 반영)</p>
                  <SentimentBar label="코스피" pct={today.kospi_weighted_pct} />
                  <SentimentBar label="코스닥" pct={today.kosdaq_weighted_pct} />
                  <p className="text-xs text-gray-600">정확도 높은 유저의 예측에 더 높은 가중치를 부여합니다</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 내 통계 ──────────────────────────────────────── */}
        <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A]">
          <p className="font-bold text-sm mb-4">내 통계</p>

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
              {/* 전체 정확도 + 순위 + 기여도 */}
              <div className="grid grid-cols-3 gap-2">
                <div
                  className="rounded-xl p-3 text-center"
                  style={{ backgroundColor: "#1F2937" }}
                >
                  <p className="text-xs text-gray-400 mb-1">전체 정확도</p>
                  <p className="text-2xl font-black text-blue-400">
                    {dash.accuracy.overall !== null ? `${dash.accuracy.overall}%` : "-"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{dash.total_predictions}일</p>
                </div>
                <div
                  className="rounded-xl p-3 text-center"
                  style={{ backgroundColor: "#1F2937" }}
                >
                  <p className="text-xs text-gray-400 mb-1">내 순위</p>
                  <p className="text-2xl font-black text-yellow-400">
                    {dash.percentile !== null ? `상위 ${dash.percentile}%` : "-"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">전체 대비</p>
                </div>
                <div
                  className="rounded-xl p-3 text-center"
                  style={{ backgroundColor: "#1F2937" }}
                >
                  <p className="text-xs text-gray-400 mb-1">가중 기여도</p>
                  <p className={`text-2xl font-black ${
                    dash.contribution !== null
                      ? dash.contribution >= 100 ? "text-green-400" : "text-orange-400"
                      : "text-gray-500"
                  }`}>
                    {dash.contribution !== null ? `${dash.contribution}%` : "-"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">평균 대비</p>
                </div>
              </div>

              {/* 코스피 vs 코스닥 정확도 */}
              <div className="flex gap-3">
                <div className="flex-1 bg-[#111] rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">코스피</p>
                  <p className="text-xl font-black text-green-400">
                    {dash.accuracy.kospi !== null ? `${dash.accuracy.kospi}%` : "-"}
                  </p>
                </div>
                <div className="flex-1 bg-[#111] rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">코스닥</p>
                  <p className="text-xl font-black text-green-400">
                    {dash.accuracy.kosdaq !== null ? `${dash.accuracy.kosdaq}%` : "-"}
                  </p>
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
