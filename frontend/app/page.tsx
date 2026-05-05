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
    icon: "🔓",
    title: "응답하면 고수 예측이 열려요",
    desc: "09:00 마감 후, 적중률 고수들의 집단 예측을 바로 확인",
    detail: {
      summary: "설문에 응답한 사람만 볼 수 있어요. 단순 다수결 외에 누적 적중률이 높은 고수들의 가중예측을 함께 공개합니다. 둘이 다를 때가 진짜 중요한 순간이에요.",
      steps: null,
      mockup: (() => {
        const Bar = ({ yes, no }: { yes: number; no: number }) => (
          <div>
            <div className="flex rounded-full overflow-hidden h-5 text-xs font-bold">
              <div className="bg-green-500 flex items-center justify-center text-white" style={{ width: `${yes}%` }}>{yes}%</div>
              <div className="bg-red-500 flex items-center justify-center text-white" style={{ width: `${no}%` }}>{no}%</div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>📈 오른다</span><span>📉 내린다</span>
            </div>
          </div>
        );
        return (
          <div className="mt-3 space-y-3">
            <div className="bg-[#1A1A1A] rounded-2xl p-4 border border-[#2A2A2A]">
              <div className="text-white text-xs font-bold mb-3">📊 단순 집계 <span className="text-gray-500 font-normal">총 128명</span></div>
              <div className="space-y-3">
                {([{ label: "KOSPI", yes: 72, no: 28 }, { label: "KOSDAQ", yes: 45, no: 55 }] as {label:string;yes:number;no:number}[]).map((item) => (
                  <div key={item.label}><p className="text-xs text-gray-400 mb-1">{item.label}</p><Bar yes={item.yes} no={item.no} /></div>
                ))}
              </div>
            </div>
            <div className="bg-[#1A1A1A] rounded-2xl p-4 border border-yellow-500/30">
              <div className="text-yellow-400 text-xs font-bold mb-1">⭐ 고수 가중예측 <span className="text-gray-500 font-normal">누적 정확도 반영</span></div>
              <p className="text-gray-600 text-xs mb-3">다수결과 다를 때가 진짜 신호</p>
              <div className="space-y-3">
                {([{ label: "KOSPI", yes: 61, no: 39 }, { label: "KOSDAQ", yes: 38, no: 62 }] as {label:string;yes:number;no:number}[]).map((item) => (
                  <div key={item.label}><p className="text-xs text-gray-400 mb-1">{item.label}</p><Bar yes={item.yes} no={item.no} /></div>
                ))}
              </div>
            </div>
          </div>
        );
      })(),
    },
  },
  {
    icon: "🎯",
    title: "고수 예측이 실제로 더 잘 맞아요",
    desc: "단순 다수결보다 고수 가중예측의 실제 적중률이 높아요",
    detail: {
      summary: "다수결은 모든 의견을 동등하게 취급하지만, 고수 가중예측은 잘 맞추는 사람의 의견에 더 무게를 줍니다. 데이터가 쌓일수록 두 예측의 정확도 차이를 직접 확인할 수 있어요.",
      steps: null,
      mockup: (
        <div className="mt-3 space-y-3">
          <div className="bg-[#1A1A1A] rounded-2xl p-4 border border-[#2A2A2A]">
            <p className="text-xs text-gray-400 font-bold mb-3">📊 누적 방향 예측 적중률 비교</p>
            {[
              { label: "단순 다수결", pct: 54, color: "bg-gray-500" },
              { label: "⭐ 고수 가중예측", pct: 67, color: "bg-yellow-400" },
            ].map((item) => (
              <div key={item.label} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">{item.label}</span>
                  <span className="text-white font-bold">{item.pct}%</span>
                </div>
                <div className="bg-[#111] rounded-full h-4 overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-600">* 예시 수치 — 실제 적중률은 서비스 내 데이터로 누적됩니다</p>
          </div>
          <div className="bg-[#1A1A1A] rounded-2xl p-3 border border-[#2A2A2A]">
            <p className="text-xs text-gray-400 font-bold mb-2">📨 15:35 결과 알림 예시</p>
            <div className="bg-[#0d1117] rounded-xl p-3 text-xs space-y-1">
              <p className="text-green-400">KOSPI ▲ +0.8% → 내 예측 ✅ 정답</p>
              <p className="text-red-400">KOSDAQ ▼ -0.3% → 내 예측 ❌ 오답</p>
              <div className="border-t border-gray-700 pt-2 mt-1 space-y-1">
                <p className="text-gray-300">🎯 누적 정확도 <b className="text-white">68%</b></p>
                <p className="text-gray-300">🏅 상위 <b className="text-yellow-400">23%</b></p>
              </div>
            </div>
          </div>
        </div>
      ),
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
      <main className="max-w-md mx-auto min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-6">🌐</div>
        <h1 className="text-xl font-black text-white mb-3">외부 브라우저에서 열어주세요</h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          앱 내 브라우저에서는 Google 로그인이 차단됩니다.<br />
          아래 버튼을 눌러 Chrome/Safari로 여세요.
        </p>
        <button
          onClick={openInExternalBrowser}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl mb-4 transition-all active:scale-95"
        >
          🌐 Chrome / Safari로 열기
        </button>
        <div className="w-full bg-[#1A1A1A] rounded-2xl border border-[#2A2A2A] p-4 text-left space-y-3">
          <p className="text-gray-400 text-xs font-bold">버튼이 안 되면 직접 입력해 주세요</p>
          <div className="flex items-center gap-2">
            <p className="text-blue-400 text-xs font-mono flex-1">kospi-prediction-game.vercel.app</p>
            <button
              onClick={() => navigator.clipboard?.writeText("https://kospi-prediction-game.vercel.app")}
              className="text-xs text-gray-500 bg-[#2A2A2A] px-2 py-1 rounded"
            >
              복사
            </button>
          </div>
          <div className="space-y-2 pt-1 border-t border-[#2A2A2A]">
            <p className="text-gray-500 text-xs">📱 iPhone: 공유 버튼 → Safari에서 열기</p>
            <p className="text-gray-500 text-xs">🤖 Android: 메뉴(⋮) → Chrome에서 열기</p>
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

      {/* 하루 흐름 타임라인 */}
      <div className="w-full mb-8">
        <p className="text-xs text-gray-500 font-bold mb-3 tracking-widest uppercase">하루 흐름</p>
        <div className="relative">
          {/* 세로 연결선 */}
          <div className="absolute left-[19px] top-4 bottom-4 w-px bg-[#2A2A2A]" />
          <div className="space-y-0">
            {[
              {
                time: "08:50",
                dot: "bg-blue-500",
                title: "텔레그램 설문 발송",
                desc: "코스피·코스닥 O/X 설문이 텔레그램으로 도착",
              },
              {
                time: "09:00",
                dot: "bg-yellow-400",
                title: "마감 → 집계 공개",
                desc: "단순 집계 + 고수 가중예측이 동시에 열려요",
              },
              {
                time: "15:35",
                dot: "bg-green-400",
                title: "장 마감 결과 집계",
                desc: "실제 등락과 내 예측을 비교해 정확도 기록",
              },
              {
                time: "다음날",
                dot: "bg-purple-400",
                title: "누적 정확도 반영",
                desc: "쌓인 적중률이 내일 고수 가중예측 계산에 반영",
              },
            ].map((step, i) => (
              <div key={i} className="flex gap-4 pb-5 last:pb-0">
                <div className="flex flex-col items-center flex-shrink-0 w-10">
                  <div className={`w-4 h-4 rounded-full border-2 border-[#111] ${step.dot} z-10 mt-1`} />
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-xs font-black text-white">{step.time}</span>
                    <span className="text-xs font-bold text-gray-300">{step.title}</span>
                  </div>
                  <p className="text-xs text-gray-500">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
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
        {browserType === "kakao" && (
          <p className="text-center text-xs text-yellow-400 mb-1">
            카카오톡에서는 카카오 로그인을 이용해 주세요
          </p>
        )}
        <button
          onClick={() => handleLogin("google")}
          disabled={signing !== null || browserType === "kakao"}
          className={`w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 disabled:opacity-30 text-gray-800 font-bold py-4 rounded-2xl transition-all active:scale-95 ${browserType === "kakao" ? "hidden" : ""}`}
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
