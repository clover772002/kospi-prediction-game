"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import LoadingPurposeSplash from "@/components/LoadingPurposeSplash";
import TournamentModeLanding from "@/components/TournamentModeLanding";
import { TOURNAMENT_LANDING } from "@/lib/tournament-copy";

function detectBrowser(): "kakao" | "inapp" | "normal" {
  if (typeof navigator === "undefined") return "normal";
  const ua = navigator.userAgent || "";
  if (/KAKAOTALK/i.test(ua)) return "kakao";
  if (/Instagram|FBAN|FBAV|Line\/|Twitter|Snapchat|TikTok|NaverApp|DaumApps|MicroMessenger/i.test(ua)) return "inapp";
  return "normal";
}

function openInExternalBrowser() {
  const url = window.location.href;
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  if (isAndroid) {
    window.location.href = `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;
  } else {
    window.location.href = `googlechrome://${url.replace(/^https?:\/\//, "")}`;
    setTimeout(() => {
      window.location.href = url;
    }, 1000);
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState<"google" | "kakao" | null>(null);
  const [browserType, setBrowserType] = useState<"kakao" | "inapp" | "normal">("normal");

  useEffect(() => {
    const type = detectBrowser();
    setBrowserType(type);
    if (type === "inapp") {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/survey");
      } else {
        setLoading(false);
      }
    });
  }, [router]);

  const handleLogin = async (provider: "google" | "kakao") => {
    setSigning(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/survey`,
      },
    });
    if (error) {
      console.error("로그인 오류:", error.message);
      setSigning(null);
    }
  };

  if (loading || signing) {
    return (
      <LoadingPurposeSplash
        mode="spinner"
        label={signing ? "대회 참가 연결 중…" : "잠시만요…"}
        accent="amber"
      />
    );
  }

  if (browserType === "inapp") {
    return (
      <main className="max-w-lg mx-auto min-h-screen flex flex-col items-center justify-center px-5 sm:px-6 text-center pb-12">
        <div className="text-7xl mb-8" aria-hidden>🌐</div>
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight">
          크롬·사파리로 열어주세요
        </h1>
        <p className="text-gray-300 text-xl sm:text-2xl leading-relaxed mb-8 px-1">
          앱 속 브라우저에서는 <span className="text-white font-bold">구글 로그인 막힘</span>
          <br />
          <span className="text-gray-400 text-lg sm:text-xl font-medium">버튼 한 번 또는 주소 입력</span>
        </p>
        <button
          onClick={openInExternalBrowser}
          type="button"
          className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xl font-black py-5 rounded-2xl mb-6 transition-all active:scale-[0.98] shadow-lg"
        >
          🌐 Chrome / Safari로 열기
        </button>
        <div className="w-full bg-[#1A1A1A] rounded-3xl border-2 border-[#2A2A2A] p-5 sm:p-6 text-left space-y-4">
          <p className="text-gray-300 text-lg sm:text-xl font-bold">버튼이 안 되면 주소 입력</p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sky-300 text-lg sm:text-xl font-mono flex-1 break-all">kospi-prediction-game.vercel.app</p>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText("https://kospi-prediction-game.vercel.app")}
              className="text-lg text-white font-bold bg-[#333] px-4 py-2.5 rounded-xl shrink-0"
            >
              복사
            </button>
          </div>
          <div className="space-y-3 pt-2 border-t border-[#333] text-gray-400 text-lg">
            <p>📱 아이폰 · 공유 → Safari</p>
            <p>🤖 안드로이드 · ⋮ 메뉴 → Chrome</p>
          </div>
        </div>
      </main>
    );
  }

  const loginAccent = "from-orange-600/20 to-[#121212] border-orange-500/35";

  return (
    <main className="w-full max-w-2xl mx-auto min-h-screen flex flex-col px-4 sm:px-6 py-8 sm:py-12 pb-28 text-[1.0625rem] sm:text-xl">
      {/* 헤더 */}
      <header className="text-center mb-8 sm:mb-10">
        <h1 className="text-[2rem] sm:text-[2.65rem] font-black text-white leading-snug px-1 mb-3">
          {TOURNAMENT_LANDING.headline}
        </h1>
        <p className="text-lg sm:text-xl text-gray-400 font-medium leading-relaxed px-2 mb-2">
          {TOURNAMENT_LANDING.subhead}
        </p>
        <p className="text-sm sm:text-base text-gray-500 font-medium px-2">
          {TOURNAMENT_LANDING.disclaimer}
        </p>
      </header>

      {/* 대회 소개 */}
      <section className="mb-8 sm:mb-10">
        <TournamentModeLanding />
      </section>

      {/* 로그인 · 대회 참가 */}
      <section
        className={`w-full rounded-3xl border-2 bg-gradient-to-b p-5 sm:p-8 mb-10 ${loginAccent}`}
      >
        <h2 className="text-[1.65rem] sm:text-[2rem] font-black text-white text-center mb-1">
          {TOURNAMENT_LANDING.loginTitle}
        </h2>
        <p className="text-center text-gray-400 text-base sm:text-lg font-medium mb-6">
          {TOURNAMENT_LANDING.ctaHint}
        </p>

        <div className="space-y-4">
          {browserType === "kakao" && (
            <p className="text-center text-xl font-black text-yellow-400">카톡 → 카카오 로그인</p>
          )}
          <button
            type="button"
            onClick={() => handleLogin("google")}
            disabled={signing !== null || browserType === "kakao"}
            className={`w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 disabled:opacity-30 text-gray-900 text-xl font-black py-5 sm:py-6 rounded-2xl transition-all active:scale-[0.98] shadow-md ${browserType === "kakao" ? "hidden" : ""}`}
          >
            {signing === "google" ? (
              <div className="w-6 h-6 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin" />
            ) : (
              <svg width="30" height="30" viewBox="0 0 48 48" aria-hidden>
                <path fill="#4285F4" d="M47.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h13.1c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.4-10.6 7.4-17.2z"/>
                <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.9-6c-2.1 1.4-4.8 2.3-7.9 2.3-6.1 0-11.2-4.1-13-9.6H2.9v6.2C6.8 42.5 14.8 48 24 48z"/>
                <path fill="#FBBC05" d="M11 28.9c-.5-1.4-.7-2.9-.7-4.4s.2-3 .7-4.4v-6.2H2.9C1.1 17.1 0 20.4 0 24s1.1 6.9 2.9 9.9l8.1-5z"/>
                <path fill="#EA4335" d="M24 9.5c3.4 0 6.5 1.2 8.9 3.5l6.6-6.6C35.9 2.4 30.5 0 24 0 14.8 0 6.8 5.5 2.9 14.1l8.1 6.2c1.8-5.5 6.9-10.8 13-10.8z"/>
              </svg>
            )}
            {signing === "google" ? "연결 중…" : "Google로 대회 참가"}
          </button>

          <button
            type="button"
            onClick={() => handleLogin("kakao")}
            disabled={signing !== null}
            className="w-full flex items-center justify-center gap-3 disabled:opacity-60 text-xl font-black py-5 sm:py-6 rounded-2xl transition-all active:scale-[0.98] shadow-md"
            style={{ backgroundColor: "#FEE500", color: "#191919" }}
          >
            {signing === "kakao" ? (
              <div className="w-6 h-6 border-2 border-yellow-700/30 border-t-yellow-800 rounded-full animate-spin" />
            ) : (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="#191919" aria-hidden>
                <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.74 1.612 5.155 4.07 6.638l-.9 3.358c-.08.296.247.535.503.37L9.93 18.8c.676.1 1.37.15 2.07.15 5.523 0 10-3.477 10-7.8S17.523 3 12 3z"/>
              </svg>
            )}
            {signing === "kakao" ? "연결 중…" : "카카오로 대회 참가"}
          </button>
        </div>

        <p className="text-base text-gray-500 text-center mt-5 px-2">
          시작 ={" "}
          <Link href="/privacy" className="underline text-gray-400 hover:text-gray-200 font-bold">
            개인정보처리방침
          </Link>{" "}
          동의 · {TOURNAMENT_LANDING.ctaHint}
        </p>
      </section>

      <p className="text-base text-gray-600 text-center mt-10 pb-8">
        © 2026 오늘 장 예측
      </p>
    </main>
  );
}
