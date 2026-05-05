"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const FEATURES = [
  {
    icon: "📱",
    title: "텔레그램 설문",
    desc: "매일 08:48 O/X 설문이 텔레그램으로 발송돼요",
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
            { time: "08:48", label: "설문 발송 (사고팔자!)", color: "bg-blue-500", active: true },
            { time: "08:48~09:00", label: "응답 가능 시간 (12분)", color: "bg-green-500", active: true },
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
    icon: "🤡",
    title: "맨날 틀린다면, 당신도 고수입니다",
    desc: "항상 틀리는 사람의 예측도 역방향 신호로 정확도에 기여해요",
    detail: {
      summary: "잘 맞추는 사람만큼, 항상 틀리는 사람도 소중한 데이터입니다. 틀린 예측은 반대 방향 신호로 자동 변환되어 가중예측의 정확도를 높여줘요. 주변에 맨날 틀리는 친구가 있다면 얼른 초대해서 적중률을 올려주세요 🙏",
      steps: null,
      mockup: (
        <div className="mt-3 space-y-3">
          {/* 적중률 비교 */}
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

          {/* 역방향 신호 알고리즘 설명 */}
          <div className="bg-[#1A1A1A] rounded-2xl p-4 border border-purple-500/20">
            <p className="text-purple-400 text-xs font-bold mb-3">🔬 틀려도 신호가 되는 알고리즘</p>
            <div className="space-y-2">
              {[
                { emoji: "🟢", label: "고수 (정확도 70%+)", effect: "예측 그대로 반영", weight: "+강하게" },
                { emoji: "🟡", label: "평균 (정확도 ~50%)", effect: "노이즈로 제외", weight: "0" },
                { emoji: "🔴", label: "역신호 (정확도 30%↓)", effect: "예측 반대로 반영", weight: "−역방향" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2 text-xs">
                  <span>{row.emoji}</span>
                  <span className="text-gray-400 flex-1">{row.label}</span>
                  <span className="text-gray-500">{row.effect}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              항상 틀리는 친구가 "오른다"고 하면 → 시스템은 <span className="text-red-400 font-bold">내린다</span> 신호로 해석합니다
            </p>
            <div className="mt-3 bg-purple-500/10 rounded-xl p-3 border border-purple-500/20">
              <p className="text-xs text-purple-300 font-bold">💡 친구 초대 꿀팁</p>
              <p className="text-xs text-gray-400 mt-1">주변에 주식 예측 맨날 틀리는 친구 있으신가요?<br />얼른 초대해서 우리 적중률 올려주세요 😂</p>
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
        <h1 className="text-2xl font-black text-white mb-1">8:48 — 사고 팔자!</h1>
        <p className="text-yellow-400 text-xs font-bold mb-3 tracking-wide">매일 아침 8시 48분, 오늘 장을 예측하세요</p>
        <p className="text-gray-400 text-sm leading-relaxed">
          코스피·코스닥이 오를지 내릴지 O/X 하나만.<br />
          맞출수록 가중치가 쌓여 커뮤니티 예측을 움직입니다.
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
                time: "08:48",
                dot: "bg-blue-500",
                title: "텔레그램 설문 발송",
                desc: "\"사고 팔자!\" 08:48, 코스피·코스닥 O/X 설문이 텔레그램으로 도착",
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
        시작하면{" "}
        <Link href="/privacy" className="underline text-gray-500 hover:text-gray-300">
          개인정보처리방침
        </Link>
        에 동의한 것으로 간주됩니다
      </p>

      {/* FAQ */}
      <div className="w-full mt-10">
        <p className="text-xs text-gray-500 font-bold mb-3 tracking-widest uppercase">자주 묻는 질문</p>
        <div className="space-y-2">
          {[
            {
              q: "완전 무료인가요?",
              a: "네, 지금은 전부 무료입니다. 고수 가중예측 열람, 내 정확도 확인, 순위까지 모두 무료예요. 유료 전환 계획이 생기면 사전에 공지합니다.",
            },
            {
              q: "매일 해야 하나요? 빠지면 불이익이 있나요?",
              a: "전혀요. 빠진 날은 그냥 기록이 없는 것뿐이에요. 가능한 날만 참여해도 되고, 참여할수록 내 누적 정확도가 쌓이는 구조라 부담 없이 시작할 수 있어요.",
            },
            {
              q: "정확도가 낮으면 어떻게 되나요?",
              a: "서비스 이용에는 아무 제한이 없어요. 다만 정확도가 낮으면 고수 가중예측에 반영되는 내 가중치가 낮아지고, 높으면 커뮤니티 예측에 내 의견이 더 많이 반영됩니다. 잘 못 맞춰도 계속 참여하는 것 자체가 의미 있어요.",
            },
            {
              q: "이걸로 실제 투자 결정을 해도 되나요?",
              a: "본 서비스는 투자 조언이 아닙니다. 집단 예측 데이터를 재미로 확인하는 서비스예요. 실제 투자 결정은 반드시 본인의 판단과 책임 하에 하세요.",
            },
            {
              q: "고수 가중예측은 언제부터 믿을 수 있나요?",
              a: "참여자가 많고 누적 데이터가 쌓일수록 신뢰도가 올라갑니다. 잘 맞추는 사람의 의견은 더 크게, 항상 틀리는 사람의 의견은 반대 방향으로 반영되기 때문에 단순 다수결보다 정교해요.",
            },
            {
              q: "예측 결과가 조작될 수 있나요?",
              a: "장 마감 후 코스피·코스닥 등락은 외부 금융 데이터(yfinance)에서 자동으로 가져옵니다. 운영자가 임의로 결과를 수정할 수 없는 구조예요.",
            },
            {
              q: "개인정보가 수집되나요?",
              a: "소셜 로그인 시 이름·이메일이 저장됩니다. 채팅 내용·연락처·위치는 수집하지 않아요. 자세한 내용은 하단 개인정보처리방침을 확인해 주세요.",
            },
            {
              q: "텔레그램이 꼭 있어야 하나요?",
              a: "설문은 텔레그램으로만 받을 수 있어요. 설치가 1분이면 되고, 광고·스팸 없이 봇 메시지만 오기 때문에 부담 없이 사용할 수 있어요.",
            },
            {
              q: "텔레그램 봇 연동은 어떻게 하나요?",
              a: "로그인 후 대시보드에서 '텔레그램 연동' 버튼을 누르면 봇 링크가 나와요. 링크를 클릭하면 텔레그램이 열리고, 시작 버튼만 누르면 완료입니다. 1분이면 끝나요.",
            },
            {
              q: "설문이 안 왔어요 / 봇이 메시지를 안 보내요",
              a: "① 대시보드에서 텔레그램 연동이 완료됐는지 확인해주세요. ② 텔레그램에서 봇을 차단했는지 확인해주세요. ③ 설문은 평일 08:48에만 발송됩니다 (주말·공휴일 제외). 그래도 해결이 안 되면 forsmartonly@gmail.com으로 문의해 주세요.",
            },
          ].map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-700 text-center mt-10 pb-6">
        © 2026 오늘 장 예측
      </p>
    </main>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#1A1A1A] rounded-2xl border border-[#2A2A2A] overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm text-white font-medium">{q}</span>
        <span className={`text-gray-500 text-lg flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-[#2A2A2A] pt-3">
          <p className="text-xs text-gray-400 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}
