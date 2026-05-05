"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const FEATURES = [
  {
    icon: "📱",
    title: "텔레그램 설문",
    desc: "매일 08:50 O/X 설문이 텔레그램으로 발송돼요",
    detail: {
      summary: "텔레그램은 전 세계 9억 명이 사용하는 메신저로, 별도 앱 설치만 하면 끝입니다. 복잡한 가입 없이 봇 하나로 설문을 받고 결과를 받아볼 수 있어요.",
      steps: [
        "① 앱스토어에서 'Telegram' 검색 후 설치",
        "② 로그인 후 봇 연동 버튼 클릭",
        "③ 매일 아침 설문 메시지 수신",
      ],
      mockup: (
        <div className="bg-[#212d3b] rounded-2xl p-4 mt-3 text-sm">
          <div className="text-gray-400 text-xs mb-3">📨 오늘 장 예측 봇</div>
          <div className="bg-[#2b5278] rounded-xl p-3 mb-2 text-white">
            📊 <b>오늘 장 예측 설문</b><br />
            <span className="text-gray-300 text-xs">코스피(KOSPI)는 오늘 어떻게 될까요?</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-[#2b5278] rounded-lg py-2 text-center text-green-400 text-xs font-bold">📈 오른다</div>
            <div className="flex-1 bg-[#2b5278] rounded-lg py-2 text-center text-red-400 text-xs font-bold">📉 내린다</div>
          </div>
        </div>
      ),
    },
  },
  {
    icon: "⏰",
    title: "10분 타임어택",
    desc: "09:00까지만 응답 가능. 늦으면 기회 없음!",
    detail: {
      summary: "장 시작 10분 전에만 응답할 수 있어요. 시장이 열리기 전 순수한 예측만 반영되기 때문에 진짜 실력을 측정할 수 있습니다.",
      steps: null,
      mockup: (
        <div className="mt-3 space-y-2">
          {[
            { time: "08:50", label: "설문 발송", color: "bg-blue-500", active: true },
            { time: "08:50~09:00", label: "응답 가능 시간", color: "bg-green-500", active: true },
            { time: "09:00", label: "응답 마감 & 집계 공개", color: "bg-yellow-500", active: true },
            { time: "09:00~", label: "장 시작 (응답 불가)", color: "bg-gray-600", active: false },
            { time: "15:35", label: "정확도 알림 발송", color: "bg-purple-500", active: true },
          ].map((item) => (
            <div key={item.time} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.color}`} />
              <span className="text-gray-400 text-xs w-24 flex-shrink-0">{item.time}</span>
              <span className={`text-xs ${item.active ? "text-white" : "text-gray-600"}`}>{item.label}</span>
            </div>
          ))}
        </div>
      ),
    },
  },
  {
    icon: "📈",
    title: "실시간 집단지성",
    desc: "09:00에 다른 사람들 예측 결과가 공개돼요",
    detail: {
      summary: "09:00이 되면 오늘 참여자 전체의 예측 결과가 공개됩니다. '오늘 72%가 코스피 상승을 예측했다' 같은 집단지성을 확인하고, 다수 의견이 맞는지 틀리는지 추적할 수 있어요.",
      steps: null,
      mockup: (
        <div className="bg-[#1A1A1A] rounded-2xl p-4 mt-3 border border-[#2A2A2A]">
          <div className="text-white text-xs font-bold mb-3">📊 오늘의 집단지성</div>
          {[
            { label: "KOSPI", yes: 72, no: 28 },
            { label: "KOSDAQ", yes: 45, no: 55 },
          ].map((item) => (
            <div key={item.label} className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{item.label}</span>
                <span>총 128명 참여</span>
              </div>
              <div className="flex rounded-full overflow-hidden h-5 text-xs font-bold">
                <div className="bg-green-500 flex items-center justify-center text-white" style={{ width: `${item.yes}%` }}>
                  {item.yes}%
                </div>
                <div className="bg-red-500 flex items-center justify-center text-white" style={{ width: `${item.no}%` }}>
                  {item.no}%
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>📈 오른다</span>
                <span>📉 내린다</span>
              </div>
            </div>
          ))}
        </div>
      ),
    },
  },
  {
    icon: "🏆",
    title: "정확도 랭킹",
    desc: "장 마감 후 내 정확도와 상위 % 순위를 알려줘요",
    detail: {
      summary: "장 마감(15:30) 후 실제 코스피·코스닥 등락을 자동으로 가져와 내 예측과 비교합니다. 누적 정확도와 전체 참여자 중 상위 몇 %인지 확인할 수 있어요.",
      steps: null,
      mockup: (
        <div className="bg-[#1A1A1A] rounded-2xl p-4 mt-3 border border-[#2A2A2A] space-y-3">
          <div className="text-white text-xs font-bold">📨 오늘의 결과 알림 예시</div>
          <div className="bg-[#0d1117] rounded-xl p-3 text-xs space-y-1">
            <p className="text-gray-300">📊 <b className="text-white">오늘 장 결과</b></p>
            <p className="text-green-400">KOSPI ▲ +0.8% → 내 예측: ✅ 정답</p>
            <p className="text-red-400">KOSDAQ ▼ -0.3% → 내 예측: ❌ 오답</p>
            <div className="border-t border-gray-700 pt-2 mt-2">
              <p className="text-gray-300">🎯 누적 정확도: <b className="text-white">68%</b></p>
              <p className="text-gray-300">🏅 상위 <b className="text-yellow-400">23%</b></p>
            </div>
          </div>
        </div>
      ),
    },
  },
];

function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|Twitter|Snapchat|TikTok|NaverApp|DaumApps|MicroMessenger/i.test(ua);
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState<"google" | "kakao" | null>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [inAppBrowser, setInAppBrowser] = useState(false);

  useEffect(() => {
    if (isInAppBrowser()) {
      setInAppBrowser(true);
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

  if (inAppBrowser) {
    return (
      <main className="max-w-md mx-auto min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-6">🌐</div>
        <h1 className="text-xl font-black text-white mb-3">브라우저에서 열어주세요</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          카카오톡·인스타그램 등 앱 내 브라우저에서는<br />
          Google 로그인이 차단됩니다.
        </p>
        <div className="w-full bg-[#1A1A1A] rounded-2xl border border-[#2A2A2A] p-5 space-y-4 text-left">
          <p className="text-white font-bold text-sm">아래 방법으로 접속해 주세요</p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-xl">📱</span>
              <div>
                <p className="text-white text-sm font-bold">iPhone</p>
                <p className="text-gray-400 text-xs">우측 하단 공유 버튼 → Safari에서 열기</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xl">🤖</span>
              <div>
                <p className="text-white text-sm font-bold">Android</p>
                <p className="text-gray-400 text-xs">우측 상단 메뉴(⋮) → Chrome에서 열기</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xl">🔗</span>
              <div>
                <p className="text-white text-sm font-bold">직접 주소 입력</p>
                <p className="text-gray-400 text-xs select-all font-mono">kospi-prediction-game.vercel.app</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto min-h-screen flex flex-col items-center justify-center px-6 py-12">
      {/* 로고 */}
      <div className="text-center mb-10">
        <div className="text-6xl mb-4">📊</div>
        <h1 className="text-2xl font-black text-white mb-2">오늘 장 예측</h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          매일 아침 코스피·코스닥이 오를지 내릴지<br />
          예측하고, 내 정확도와 순위를 확인하세요.
        </p>
      </div>

      {/* 아코디언 설명 카드 */}
      <div className="w-full space-y-2 mb-10">
        {FEATURES.map((item, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={item.title}
              className="bg-[#1A1A1A] rounded-2xl border border-[#2A2A2A] overflow-hidden transition-all"
            >
              <button
                className="w-full flex items-center gap-4 px-4 py-3 text-left"
                onClick={() => setOpenIdx(isOpen ? null : idx)}
              >
                <span className="text-2xl flex-shrink-0">{item.icon}</span>
                <div className="flex-1">
                  <p className="font-bold text-sm text-white">{item.title}</p>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
                <span className={`text-gray-500 text-lg transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                  ▾
                </span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4">
                  <div className="border-t border-[#2A2A2A] pt-3">
                    <p className="text-gray-300 text-xs leading-relaxed mb-2">{item.detail.summary}</p>
                    {item.detail.steps && (
                      <div className="space-y-1 mb-2">
                        {item.detail.steps.map((s) => (
                          <p key={s} className="text-xs text-blue-400">{s}</p>
                        ))}
                      </div>
                    )}
                    {item.detail.mockup}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 로그인 버튼 그룹 */}
      <div className="w-full space-y-3">
        <button
          onClick={() => handleLogin("google")}
          disabled={signing !== null}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 disabled:opacity-60 text-gray-800 font-bold py-4 rounded-2xl transition-all active:scale-95"
        >
          {signing === "google" ? (
            <div className="w-5 h-5 border-2 border-gray-400/30 border-t-gray-600 rounded-full animate-spin" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M47.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h13.1c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.4-10.6 7.4-17.2z"/>
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.9-6c-2.1 1.4-4.8 2.3-7.9 2.3-6.1 0-11.2-4.1-13-9.6H2.9v6.2C6.8 42.5 14.8 48 24 48z"/>
              <path fill="#FBBC05" d="M11 28.9c-.5-1.4-.7-2.9-.7-4.4s.2-3 .7-4.4v-6.2H2.9C1.1 17.1 0 20.4 0 24s1.1 6.9 2.9 9.9l8.1-5z"/>
              <path fill="#EA4335" d="M24 9.5c3.4 0 6.5 1.2 8.9 3.5l6.6-6.6C35.9 2.4 30.5 0 24 0 14.8 0 6.8 5.5 2.9 14.1l8.1 6.2c1.8-5.5 6.9-10.8 13-10.8z"/>
            </svg>
          )}
          {signing === "google" ? "로그인 중..." : "Google로 시작하기"}
        </button>

        <button
          onClick={() => handleLogin("kakao")}
          disabled={signing !== null}
          className="w-full flex items-center justify-center gap-3 disabled:opacity-60 font-bold py-4 rounded-2xl transition-all active:scale-95"
          style={{ backgroundColor: "#FEE500", color: "#191919" }}
        >
          {signing === "kakao" ? (
            <div className="w-5 h-5 border-2 border-yellow-700/30 border-t-yellow-800 rounded-full animate-spin" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#191919">
              <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.74 1.612 5.155 4.07 6.638l-.9 3.358c-.08.296.247.535.503.37L9.93 18.8c.676.1 1.37.15 2.07.15 5.523 0 10-3.477 10-7.8S17.523 3 12 3z"/>
            </svg>
          )}
          {signing === "kakao" ? "로그인 중..." : "카카오로 시작하기"}
        </button>
      </div>

      <p className="text-xs text-gray-600 text-center mt-4">
        소셜 계정으로 간편하게 시작할 수 있어요
      </p>
    </main>
  );
}
