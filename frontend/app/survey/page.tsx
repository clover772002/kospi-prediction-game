"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getToday, TodaySurvey } from "@/lib/api";
import FlipClock from "@/components/FlipClock";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function SurveyPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [today, setToday] = useState<TodaySurvey | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kospiAnswer, setKospiAnswer] = useState<boolean | null>(null);

  const loadToday = useCallback(async () => {
    try {
      const data = await getToday();
      setToday(data);
    } catch {
      setError("설문 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session)) {
        router.replace("/");
        return;
      }
      if (session) {
        setToken(session.access_token);
        loadToday();
      }
    });
    return () => subscription.unsubscribe();
  }, [router, loadToday]);

  const handleSubmit = async () => {
    if (!token || kospiAnswer === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/survey/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ kospi_answer: kospiAnswer }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "오류가 발생했습니다." }));
        throw new Error(err.detail);
      }
      setSubmitted(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const BottomNav = () => (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-[#222] flex max-w-md mx-auto">
      <button onClick={() => router.push("/survey")} className="flex-1 flex flex-col items-center py-3 gap-1 text-white">
        <span className="text-xl">📝</span>
        <span className="text-xs font-bold">설문</span>
      </button>
      <button onClick={() => router.push("/dashboard")} className="flex-1 flex flex-col items-center py-3 gap-1 text-gray-500 hover:text-gray-300 transition-colors">
        <span className="text-xl">📊</span>
        <span className="text-xs font-medium">대시보드</span>
      </button>
      <button onClick={() => router.push("/setup")} className="flex-1 flex flex-col items-center py-3 gap-1 text-gray-500 hover:text-gray-300 transition-colors">
        <span className="text-xl">⚙️</span>
        <span className="text-xs font-medium">설정</span>
      </button>
    </nav>
  );

  if (loading) {
    return (
      <main className="max-w-md mx-auto min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </main>
    );
  }

  const status = today?.status ?? "no_survey";

  return (
    <main className="max-w-md mx-auto min-h-screen pb-36 px-5">
      <div className="pt-10 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">오늘 장 예측</h1>
          <p className="text-xs text-gray-500 mt-1">
            {(() => {
              const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
              return `${kst.getFullYear()}.${String(kst.getMonth()+1).padStart(2,"0")}.${String(kst.getDate()).padStart(2,"0")} (KST)`;
            })()}
          </p>
        </div>
      </div>

      {/* 설문 없음 — 대기중 vs 휴장일 구분 */}
      {status === "no_survey" && (() => {
        const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        const day = kst.getDay();
        const mins = kst.getHours() * 60 + kst.getMinutes();
        const isWeekend = day === 0 || day === 6;
        const isPreSurvey = !isWeekend && mins < 8 * 60 + 48;
        return (
          <div className="flex flex-col gap-5 mt-10">
            <div className="flex flex-col items-center gap-3 text-center">
              {isPreSurvey ? (
                <>
                  <div className="text-5xl">⏳</div>
                  <p className="text-xl font-bold text-white">설문 시작 전이에요</p>
                  <p className="text-sm text-gray-400">
                    <span className="text-white font-bold">08:48</span>에 오늘 코스피 예측 설문이 시작돼요
                  </p>
                </>
              ) : (
                <>
                  <div className="text-5xl">🏖️</div>
                  <p className="text-xl font-bold text-white">오늘은 설문이 없어요</p>
                  <p className="text-sm text-gray-400">주말·공휴일에는 장이 열리지 않아요</p>
                </>
              )}
            </div>
            <FlipClock />
          </div>
        );
      })()}

      {/* 설문 진행 중 */}
      {status === "open" && !submitted && (
        <div className="space-y-6 mt-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center">
            <p className="text-amber-400 font-bold text-sm">⏰ 설문 진행 중 · 09:00 마감</p>
          </div>

          {/* 코스피 단일 질문 */}
          <div className="bg-[#1A1A1A] rounded-2xl p-5 space-y-4 border border-[#2A2A2A]">
            <p className="font-bold text-white text-base">📈 코스피 오늘 어떨까요?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setKospiAnswer(true)}
                className={`py-5 rounded-2xl font-black text-xl transition-all active:scale-95 border-2 ${
                  kospiAnswer === true
                    ? "bg-green-500 border-green-400 text-white"
                    : "bg-[#111] border-[#333] text-gray-400 hover:border-green-600"
                }`}
              >
                📈 오른다
              </button>
              <button
                onClick={() => setKospiAnswer(false)}
                className={`py-5 rounded-2xl font-black text-xl transition-all active:scale-95 border-2 ${
                  kospiAnswer === false
                    ? "bg-red-500 border-red-400 text-white"
                    : "bg-[#111] border-[#333] text-gray-400 hover:border-red-600"
                }`}
              >
                📉 내린다
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={kospiAnswer === null || submitting}
            className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:bg-[#333] disabled:text-gray-500 text-white font-black text-xl rounded-2xl transition-all active:scale-95"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                제출 중...
              </span>
            ) : "예측 제출하기"}
          </button>

          {kospiAnswer === null && (
            <p className="text-center text-xs text-gray-600">오른다 / 내린다 중 하나를 선택해주세요</p>
          )}
        </div>
      )}

      {/* 제출 완료 */}
      {status === "open" && submitted && (
        <div className="flex flex-col items-center justify-center gap-5 mt-20 text-center">
          <div className="text-6xl">✅</div>
          <p className="text-xl font-bold text-white">예측 완료!</p>
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-5 w-full space-y-2">
            <p className="text-sm text-gray-400">내 예측</p>
            <p className="text-white font-bold text-lg">
              코스피 {kospiAnswer ? "📈 오른다" : "📉 내린다"}
            </p>
          </div>
          <p className="text-xs text-gray-500">09:00에 집계 결과가 공개돼요</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full py-4 bg-[#1A1A1A] border border-[#2A2A2A] text-gray-300 font-bold rounded-2xl"
          >
            대시보드로 이동
          </button>
        </div>
      )}

      {/* 설문 마감 후 */}
      {(status === "closed" || status === "result") && (
        <div className="flex flex-col gap-5 mt-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="text-5xl">{status === "result" ? "📊" : "🔒"}</div>
            <p className="text-xl font-bold text-white">
              {status === "result" ? "오늘 결과 공개됐어요" : "설문이 마감됐어요"}
            </p>
            <p className="text-sm text-gray-400">
              {status === "result"
                ? "대시보드에서 결과와 내 정확도를 확인하세요"
                : "09:00에 집계가 끝났어요. 15:35에 결과가 공개돼요"}
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all"
            >
              대시보드에서 결과 보기
            </button>
          </div>
          <FlipClock />
        </div>
      )}

      <BottomNav />
    </main>
  );
}
