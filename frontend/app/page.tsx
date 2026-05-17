"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import SurveyConfidencePlayground from "@/components/SurveyConfidencePlayground";
import ExpertMessageConceptPlayground from "@/components/ExpertMessageConceptPlayground";
import ExpertPickRevealPlayground from "@/components/ExpertPickRevealPlayground";
import LandingFlowDiagram from "@/components/LandingFlowDiagram";

type LandingFeatureDetail = {
  summary: string;
  steps: string[] | null;
  mockup: ReactNode;
};

type LandingFeature = {
  icon: string;
  title: string;
  desc: string;
  detail: LandingFeatureDetail;
};

const FEATURES: LandingFeature[] = [
  {
    icon: "🔔",
    title: "알림으로 설문",
    desc: "한 번 안내 · 한 번 탭",
    detail: {
      summary: "",
      steps: null,
      mockup: (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border-2 border-[#444] bg-[#1A1A1A] p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-purple-600 text-3xl">📊</div>
              <div className="min-w-0 flex-1 pt-1">
                <p className="text-lg font-black leading-tight text-white sm:text-xl">오늘 코스피 설문</p>
                <p className="mt-2 text-base font-bold text-gray-400">🔔 안내 받고 → 📱 알림 탭하면 됩니다</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-[#444] bg-[#111] p-5 sm:p-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border-2 border-red-500/55 bg-red-500/20 py-4 text-center text-lg font-black text-red-100">
                📈 상승
              </div>
              <div className="rounded-xl border-2 border-blue-500/55 bg-blue-500/25 py-4 text-center text-lg font-black text-blue-100">
                📉 하락
              </div>
            </div>
          </div>
        </div>
      ),
    },
  },
  {
    icon: "📊",
    title: "집단 에너지",
    desc: "많은 사람이 참여하면",
    detail: {
      summary: "",
      steps: null,
      mockup: (() => {
        const Bar = ({ yes, no }: { yes: number; no: number }) => (
          <div>
            <div className="flex h-10 overflow-hidden rounded-full text-lg font-black">
              <div className="flex items-center justify-center bg-red-500 text-white" style={{ width: `${yes}%` }}>
                {yes}%
              </div>
              <div className="flex items-center justify-center bg-blue-500 text-white" style={{ width: `${no}%` }}>
                {no}%
              </div>
            </div>
            <div className="mt-2 flex justify-between px-2 text-base font-bold text-gray-400">
              <span>📈 업</span>
              <span>📉 다운</span>
            </div>
          </div>
        );
        return (
          <div className="mt-4 space-y-5">
            <div className="rounded-2xl border-2 border-[#383838] bg-[#1A1A1A] p-5 sm:p-6">
              <p className="mb-5 text-xl font-black text-white">📊 참여 결과</p>
              <Bar yes={72} no={28} />
            </div>
            <div className="rounded-2xl border-2 border-amber-500/45 bg-[#1A1A1A] p-5 sm:p-6">
              <p className="text-xl font-black text-yellow-200">⭐ 반영 버전 예시</p>
              <div className="mt-5">
                <Bar yes={61} no={39} />
              </div>
            </div>
          </div>
        );
      })(),
    },
  },
];

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
  const [openIdx, setOpenIdx] = useState<number | null>(null);
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
        router.replace("/dashboard");
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
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) {
      console.error("로그인 오류:", error.message);
      setSigning(null);
    }
  };

  if (loading) {
    return (
      <main className="max-w-md mx-auto min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </main>
    );
  }

  if (browserType === "inapp") {
    return (
      <main className="max-w-lg mx-auto min-h-screen flex flex-col items-center justify-center px-5 sm:px-6 text-center pb-12">
        <div className="text-7xl mb-8" aria-hidden>🌐</div>
        <h1 className="text-2xl sm:text-3xl font-black text-white mb-4 leading-tight">
          크롬·사파리로 열어주세요
        </h1>
        <p className="text-gray-300 text-lg sm:text-xl leading-relaxed mb-8 px-1">
          앱 속 브라우저에서는 <span className="text-white font-bold">구글 로그인 막힘</span>
          <br />
          <span className="text-gray-400 text-base font-medium">버튼 한 번 또는 주소 입력</span>
        </p>
        <button
          onClick={openInExternalBrowser}
          type="button"
          className="w-full bg-blue-600 hover:bg-blue-500 text-white text-lg font-black py-5 rounded-2xl mb-6 transition-all active:scale-[0.98] shadow-lg"
        >
          🌐 Chrome / Safari로 열기
        </button>
        <div className="w-full bg-[#1A1A1A] rounded-3xl border-2 border-[#2A2A2A] p-5 sm:p-6 text-left space-y-4">
          <p className="text-gray-300 text-base font-bold">버튼이 안 되면 주소 입력</p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sky-300 text-base font-mono flex-1 break-all">kospi-prediction-game.vercel.app</p>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText("https://kospi-prediction-game.vercel.app")}
              className="text-base text-white font-bold bg-[#333] px-4 py-2.5 rounded-xl shrink-0"
            >
              복사
            </button>
          </div>
          <div className="space-y-3 pt-2 border-t border-[#333] text-gray-400 text-base">
            <p>📱 아이폰 · 공유 → Safari</p>
            <p>🤖 안드로이드 · ⋮ 메뉴 → Chrome</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full max-w-2xl mx-auto min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-10 sm:py-14 pb-28 text-[17px] sm:text-lg">
      <div className="text-center mb-8">
        <div className="text-7xl sm:text-8xl mb-5 drop-shadow-lg" aria-hidden>
          📊
        </div>
        <h1 className="text-3xl sm:text-[2rem] font-black text-white mb-3 leading-snug px-1">
          오늘 코스피, 같이 맞혀요
        </h1>
        <p className="text-amber-200 text-lg sm:text-xl font-black mb-1">예측 → 토큰 → 고수</p>
        <p className="text-gray-400 font-bold text-base sm:text-lg">아래 그림처럼 두 단계예요</p>
      </div>

      <LandingFlowDiagram />

      <div className="w-full mb-10 min-w-0 space-y-10">
        <section className="min-w-0 rounded-3xl border-2 border-[#333] bg-[#121212]/50 p-5 sm:p-7">
          <h2 className="text-xl sm:text-2xl font-black text-white mb-2">① 예측 · 토큰</h2>
          <p className="text-gray-400 font-bold text-base mb-5">확신 · 상승/하락 (예시 화면)</p>
          <SurveyConfidencePlayground />
        </section>

        <section className="min-w-0 rounded-3xl border-2 border-[#333] bg-[#121212]/50 p-5 sm:p-7">
          <h2 className="text-xl sm:text-2xl font-black text-white mb-2">② 고수</h2>
          <p className="text-gray-400 font-bold text-base mb-6">선택픽 · 질문 (예시)</p>

          <div className="space-y-8">
            <div>
              <p className="text-lg text-amber-200 font-black mb-3">토큰 → 선택픽</p>
              <ExpertPickRevealPlayground />
            </div>
            <div>
              <p className="text-lg text-sky-300 font-black mb-3">토큰 → 메시지</p>
              <ExpertMessageConceptPlayground />
            </div>
          </div>
        </section>
      </div>

      {/* 아코디언 설명 카드 */}
      <div className="w-full space-y-3 mb-10">
        {FEATURES.map((item, idx) => {
          const isOpen = openIdx === idx;
          const summary = item.detail.summary?.trim();
          return (
            <div
              key={item.title}
              className="bg-[#1A1A1A] rounded-3xl border-2 border-[#2A2A2A] overflow-hidden transition-all"
            >
              <button
                type="button"
                className="w-full flex items-center gap-4 px-5 py-4 sm:py-5 text-left"
                onClick={() => setOpenIdx(isOpen ? null : idx)}
              >
                <span className="text-4xl sm:text-5xl flex-shrink-0 leading-none">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-lg sm:text-xl text-white">{item.title}</p>
                  <p className="text-gray-400 font-bold text-base mt-0.5">{item.desc}</p>
                </div>
                <span className={`text-gray-500 text-2xl flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                  ▾
                </span>
              </button>

              {isOpen && (
                <div className="px-5 pb-5">
                  <div className="border-t border-[#333] pt-4">
                    {summary ? (
                      <p className="text-gray-200 text-base sm:text-lg leading-relaxed mb-3">{summary}</p>
                    ) : null}
                    {item.detail.steps && item.detail.steps.length > 0 ? (
                      <div className="space-y-2 mb-4">
                        {item.detail.steps.map((s, i) => (
                          <p
                            key={s}
                            className={`text-base ${
                              i === item.detail.steps!.length - 1 && s.startsWith("💡") ? "text-yellow-300 font-bold" : "text-sky-300 font-bold"
                            }`}
                          >
                            {s}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {item.detail.mockup}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 로그인 버튼 그룹 */}
      <div className="w-full space-y-4">
        {browserType === "kakao" && (
          <p className="text-center text-lg font-black text-yellow-400 mb-1">카톡 → 카카오 로그인</p>
        )}
        <button
          type="button"
          onClick={() => handleLogin("google")}
          disabled={signing !== null || browserType === "kakao"}
          className={`w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 disabled:opacity-30 text-gray-900 text-lg font-black py-5 rounded-2xl transition-all active:scale-[0.98] shadow-md ${browserType === "kakao" ? "hidden" : ""}`}
        >
          {signing === "google" ? (
            <div className="w-6 h-6 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin" />
          ) : (
            <svg width="26" height="26" viewBox="0 0 48 48" aria-hidden>
              <path fill="#4285F4" d="M47.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h13.1c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.4-10.6 7.4-17.2z"/>
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.9-6c-2.1 1.4-4.8 2.3-7.9 2.3-6.1 0-11.2-4.1-13-9.6H2.9v6.2C6.8 42.5 14.8 48 24 48z"/>
              <path fill="#FBBC05" d="M11 28.9c-.5-1.4-.7-2.9-.7-4.4s.2-3 .7-4.4v-6.2H2.9C1.1 17.1 0 20.4 0 24s1.1 6.9 2.9 9.9l8.1-5z"/>
              <path fill="#EA4335" d="M24 9.5c3.4 0 6.5 1.2 8.9 3.5l6.6-6.6C35.9 2.4 30.5 0 24 0 14.8 0 6.8 5.5 2.9 14.1l8.1 6.2c1.8-5.5 6.9-10.8 13-10.8z"/>
            </svg>
          )}
          {signing === "google" ? "연결 중…" : "Google로 시작"}
        </button>

        <button
          type="button"
          onClick={() => handleLogin("kakao")}
          disabled={signing !== null}
          className="w-full flex items-center justify-center gap-3 disabled:opacity-60 text-lg font-black py-5 rounded-2xl transition-all active:scale-[0.98] shadow-md"
          style={{ backgroundColor: "#FEE500", color: "#191919" }}
        >
          {signing === "kakao" ? (
            <div className="w-6 h-6 border-2 border-yellow-700/30 border-t-yellow-800 rounded-full animate-spin" />
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#191919" aria-hidden>
              <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.74 1.612 5.155 4.07 6.638l-.9 3.358c-.08.296.247.535.503.37L9.93 18.8c.676.1 1.37.15 2.07.15 5.523 0 10-3.477 10-7.8S17.523 3 12 3z"/>
            </svg>
          )}
          {signing === "kakao" ? "연결 중…" : "카카오로 시작"}
        </button>
      </div>

      <p className="text-base text-gray-500 text-center mt-5 px-2">
        시작 ={" "}
        <Link href="/privacy" className="underline text-gray-400 hover:text-gray-200 font-bold">
          개인정보처리방침
        </Link>{" "}
        동의
      </p>

      {/* FAQ */}
      <div className="w-full mt-12">
        <p className="text-gray-400 font-black text-xl sm:text-2xl mb-4">자주 묻는 질문</p>
        <div className="space-y-3">
          {[
            {
              q: "완전 무료인가요?",
              a: "기본 참여 무료 · 토큰은 참여로 쌓임 · 유료 생기면 먼저 공지",
            },
            {
              q: "매일 해야 하나요?",
              a: "아니요 · 빠져도 패널티 없음",
            },
            {
              q: "정확도가 낮으면?",
              a: "이용 제한 없음 · 높을수록 반영 많음",
            },
            {
              q: "투자 참고 삼아도 되나요?",
              a: "투자 조언 아님 · 참고만 · 본인 책임",
            },
            {
              q: "고수 예측은?",
              a: "참여·데이터 많을수록 신뢰 ↑",
            },
            {
              q: "고수랑 어떻게?",
              a: '「고수」탭 · 토큰 차감 → 고수 수락 시 전달 · 답장 받기 무료',
            },
            {
              q: "결과 조작?",
              a: "장 마감 후 외부 데이터로 자동 · 수동 수정 없음",
            },
            {
              q: "개인정보?",
              a: "로그인 시 이름·이메일 · 메시지(사용 시) 저장 · 자세히는 처리방침",
            },
            {
              q: "알림?",
              a: "설정 → 브라우저 알림 · 앱 없이 가능",
            },
            {
              q: "텔레그램?",
              a: "필수 아님 · 알림만으로 OK · 텔레그램은 편하면 선택",
            },
            {
              q: "알림 안 옴",
              a: "설정 허용 확인 · 아이폰은 Safari 추가 권장 · 문의 forsmartonly@gmail.com",
            },
          ].map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-600 text-center mt-10 pb-8">
        © 2026 오늘 장 예측
      </p>
    </main>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#1A1A1A] rounded-3xl border-2 border-[#2A2A2A] overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 px-5 py-4 sm:py-5 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-lg sm:text-xl text-white font-black pr-2 leading-snug">{q}</span>
        <span className={`text-gray-500 text-2xl flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-[#333] pt-4">
          <p className="text-base sm:text-lg text-gray-300 leading-relaxed font-bold">{a}</p>
        </div>
      )}
    </div>
  );
}
