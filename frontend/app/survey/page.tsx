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
      setError("?ㅻЦ ?뺣낫瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??");
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
        const err = await res.json().catch(() => ({ detail: "?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." }));
        throw new Error(err.detail);
      }
      setSubmitted(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.");
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
          <h1 className="text-2xl font-black text-white">?ㅻ뒛 ???덉륫</h1>
          <p className="text-xs text-gray-500 mt-1">
            {(() => {
              const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
              return `${kst.getFullYear()}.${String(kst.getMonth()+1).padStart(2,"0")}.${String(kst.getDate()).padStart(2,"0")} (KST)`;
            })()}
          </p>
        </div>
      </div>

      {/* ?ㅻЦ ?놁쓬 ???湲곗쨷 vs ?댁옣??援щ텇 */}
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
                  <div className="text-5xl">??/div>
                  <p className="text-xl font-bold text-white">?ㅻЦ ?쒖옉 ?꾩씠?먯슂</p>
                  <p className="text-sm text-gray-400">
                    <span className="text-white font-bold">08:48</span>???ㅻ뒛 肄붿뒪???덉륫 ?ㅻЦ???쒖옉?쇱슂
                  </p>
                </>
              ) : (
                <>
                  <div className="text-5xl">?룚截?/div>
                  <p className="text-xl font-bold text-white">?ㅻ뒛? ?ㅻЦ???놁뼱??/p>
                  <p className="text-sm text-gray-400">二쇰쭚쨌怨듯쑕?쇱뿉???μ씠 ?대━吏 ?딆븘??/p>
                </>
              )}
            </div>
            <FlipClock />
          </div>
        );
      })()}

      {/* ?ㅻЦ 吏꾪뻾 以?*/}
      {status === "open" && !submitted && (
        <div className="space-y-6 mt-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center">
            <p className="text-amber-400 font-bold text-sm">???ㅻЦ 吏꾪뻾 以?쨌 09:00 留덇컧</p>
          </div>

          {/* 肄붿뒪???⑥씪 吏덈Ц */}
          <div className="bg-[#1A1A1A] rounded-2xl p-5 space-y-4 border border-[#2A2A2A]">
            <p className="font-bold text-white text-base">?뱢 肄붿뒪???ㅻ뒛 ?대뼥源뚯슂?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setKospiAnswer(true)}
                className={`py-5 rounded-2xl font-black text-xl transition-all active:scale-95 border-2 ${
                  kospiAnswer === true
                    ? "bg-green-500 border-green-400 text-white"
                    : "bg-[#111] border-[#333] text-gray-400 hover:border-green-600"
                }`}
              >
                ?뱢 ?ㅻⅨ??              </button>
              <button
                onClick={() => setKospiAnswer(false)}
                className={`py-5 rounded-2xl font-black text-xl transition-all active:scale-95 border-2 ${
                  kospiAnswer === false
                    ? "bg-red-500 border-red-400 text-white"
                    : "bg-[#111] border-[#333] text-gray-400 hover:border-red-600"
                }`}
              >
                ?뱣 ?대┛??              </button>
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
                ?쒖텧 以?..
              </span>
            ) : "?덉륫 ?쒖텧?섍린"}
          </button>

          {kospiAnswer === null && (
            <p className="text-center text-xs text-gray-600">?ㅻⅨ??/ ?대┛??以??섎굹瑜??좏깮?댁＜?몄슂</p>
          )}
        </div>
      )}

      {/* ?쒖텧 ?꾨즺 */}
      {status === "open" && submitted && (
        <div className="flex flex-col items-center justify-center gap-5 mt-20 text-center">
          <div className="text-6xl">??/div>
          <p className="text-xl font-bold text-white">?덉륫 ?꾨즺!</p>
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-5 w-full space-y-2">
            <p className="text-sm text-gray-400">???덉륫</p>
            <p className="text-white font-bold text-lg">
              肄붿뒪??{kospiAnswer ? "?뱢 ?ㅻⅨ?? : "?뱣 ?대┛??}
            </p>
          </div>
          <p className="text-xs text-gray-500">09:00??吏묎퀎 寃곌낵媛 怨듦컻?쇱슂</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full py-4 bg-[#1A1A1A] border border-[#2A2A2A] text-gray-300 font-bold rounded-2xl"
          >
            ??쒕낫?쒕줈 ?대룞
          </button>
        </div>
      )}

      {/* ?ㅻЦ 留덇컧 ??*/}
      {(status === "closed" || status === "result") && (
        <div className="flex flex-col gap-5 mt-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="text-5xl">{status === "result" ? "?뱤" : "?뵏"}</div>
            <p className="text-xl font-bold text-white">
              {status === "result" ? "?ㅻ뒛 寃곌낵 怨듦컻?먯뼱?? : "?ㅻЦ??留덇컧?먯뼱??}
            </p>
            <p className="text-sm text-gray-400">
              {status === "result"
                ? "??쒕낫?쒖뿉??寃곌낵? ???뺥솗?꾨? ?뺤씤?섏꽭??
                : "09:00??吏묎퀎媛 ?앸궗?댁슂. 15:35??寃곌낵媛 怨듦컻?쇱슂"}
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all"
            >
              ??쒕낫?쒖뿉??寃곌낵 蹂닿린
            </button>
          </div>
          <FlipClock />
        </div>
      )}

      <BottomNav />
    </main>
  );
}
