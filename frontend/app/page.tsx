"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import SurveyConfidencePlayground from "@/components/SurveyConfidencePlayground";
import DuelConceptPlayground from "@/components/DuelConceptPlayground";
import ExpertPickRevealPlayground from "@/components/ExpertPickRevealPlayground";

const FEATURES = [
  {
    icon: "📱",
    title: "설문",
    desc: "매일 밤 22:00 알림이 오면 웹앱에서 클릭 한 번",
    detail: {
      summary: "브라우저 알림을 허용하면 매일 밤 알림이 와요. 알림을 탭하면 바로 설문 페이지로 이동하고, O/X 클릭 한 번으로 참여 완료입니다.",
      steps: [
        "① 로그인 후 설정 → 브라우저 알림 허용",
        "② 매일 밤 22:00 알림 수신",
        "③ 알림 탭 → 설문 페이지에서 클릭 한 번",
        "💡 매번 접속이 귀찮다면? 텔레그램 봇 연결 시 메시지로 바로 참여 가능",
      ],
      mockup: (
        <div className="mt-3 space-y-2 text-sm">
          {/* 브라우저 알림 mockup */}
          <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-base flex-shrink-0">📊</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white">오늘 코스피 예측 설문</p>
                <p className="text-[11px] text-gray-400">오늘 코스피 어떻게 될까요? 지금 참여하세요</p>
                <p className="text-[10px] text-gray-600 mt-0.5">오늘 코스피, 함께 맞춰요 · 지금</p>
              </div>
            </div>
          </div>
          {/* 설문 UI mockup */}
          <div className="bg-[#111] border border-[#2A2A2A] rounded-2xl p-4">
            <p className="text-[11px] text-gray-400 mb-2">알림 탭 → 바로 설문 참여</p>
            <div className="flex gap-2">
              <div className="flex-1 bg-green-500/20 border border-green-500/40 rounded-xl py-3 text-center text-green-400 text-xs font-bold">📈 상승</div>
              <div className="flex-1 bg-red-500/20 border border-red-500/40 rounded-xl py-3 text-center text-red-400 text-xs font-bold">📉 하락</div>
            </div>
          </div>
        </div>
      ),
    },
  },
  {
    icon: "🎫",
    title: "토큰으로 고수 선택픽 열람",
    desc: "모은 토큰으로 강화 예측·고수 진영 방향을 해제해 비교합니다",
    detail: {
      summary:
        "설문과 적중으로 쌓은 토큰을 쓰면 오늘의 고수 선택 방향·강화 집계 일부가 펼쳐져요. 단순 다수결과 다른 지점을 보는 데 쓰이고, 실제 차감량·표시 시간은 서비스 정책에 따라 달라질 수 있어요.",
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
                <div><p className="text-xs text-gray-400 mb-1">KOSPI</p><Bar yes={72} no={28} /></div>
              </div>
            </div>
            <div className="bg-[#1A1A1A] rounded-2xl p-4 border border-yellow-500/30">
              <div className="text-yellow-400 text-xs font-bold mb-1">⭐ 고수 강화예측 <span className="text-gray-500 font-normal">누적 정확도 반영</span></div>
              <p className="text-gray-600 text-xs mb-3">다수결과 다를 때가 진짜 신호</p>
              <div className="space-y-3">
                <div><p className="text-xs text-gray-400 mb-1">KOSPI</p><Bar yes={61} no={39} /></div>
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
              { label: "⭐ 고수 강화예측", pct: 67, color: "bg-yellow-400" },
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
    <main className="w-full max-w-xl mx-auto min-h-screen flex flex-col items-center justify-center px-4 sm:px-5 py-12 pb-24">
      {/* 로고 */}
      <div className="text-center mb-10">
        <div className="text-6xl mb-4">📊</div>
        <h1 className="text-2xl font-black text-white mb-1">오늘 코스피, 함께 맞춰요</h1>
        <p className="text-amber-200/90 text-xs font-bold mb-3 tracking-wide">코스피 예측으로 토큰 · 대결하면 더 받기</p>
        <p className="text-gray-400 text-sm leading-relaxed">
          방향을 맞히면 재화가 쌓이고, 같은 적중이라도 대결 레이어를 타면 더 커지는 구조예요. 모은 토큰으로 고수 선택픽도 열 수 있어요.
        </p>
      </div>

      {/* ── 큰 틀: 예측·토큰 → 고수픽 → 대결 ───────────────── */}
      <div className="w-full mb-2 min-w-0">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-500/30 to-transparent mb-6" aria-hidden />
        <p className="text-[10px] text-gray-600 font-black tracking-[0.18em] mb-3 uppercase">어떻게 즐기나요</p>
        <div className="flex flex-wrap justify-center gap-2 mb-4 text-[10px] text-gray-400">
          <span className="rounded-full border border-amber-500/25 bg-amber-500/[0.07] px-2.5 py-1 font-bold text-amber-100/95">① 예측·토큰</span>
          <span className="rounded-full border border-yellow-500/20 bg-yellow-500/[0.06] px-2.5 py-1 font-bold text-yellow-100/85">② 고수픽</span>
          <span className="rounded-full border border-violet-500/25 bg-violet-500/[0.08] px-2.5 py-1 font-bold text-violet-200/90">③ 대결 보너스</span>
        </div>
      </div>

      <div className="w-full mb-8 min-w-0 space-y-8">
        <section className="min-w-0">
          <p className="text-[11px] text-amber-200/95 font-black tracking-[0.12em] mb-2">① 코스피 예측 → 토큰</p>
          <h2 className="text-base font-black text-white mb-1">코스피를 예측하고 토큰을 받아요</h2>
          <p className="text-[11px] text-gray-600 mb-3 leading-relaxed">
            확신 게이지·집단배율까지 실제 설문과 같은 패턴입니다 · 아래는 반복 재생 데모입니다
          </p>
          <SurveyConfidencePlayground />
        </section>

        <section className="min-w-0">
          <p className="text-[11px] text-yellow-400/95 font-black tracking-[0.12em] mb-2">② 토큰 → 고수 선택픽</p>
          <h2 className="text-base font-black text-white mb-1">토큰으로 고수의 선택을 열람해요</h2>
          <p className="text-[11px] text-gray-600 mb-3 leading-relaxed">
            차감·해제 순간은 애니메이션으로 강조해 두었어요 · 비용 표시와 픽 내용은 이해용 예시예요
          </p>
          <ExpertPickRevealPlayground />
        </section>

        <section className="min-w-0">
          <p className="text-[11px] text-violet-300 font-black tracking-[0.12em] mb-2">③ 대결 → 토큰 한 층 더</p>
          <h2 className="text-base font-black text-white mb-1">대결까지 가면 토큰이 더 받는 흐름이에요</h2>
          <p className="text-[11px] text-gray-600 mb-3 leading-relaxed">
            순위·VS·연승·그룹 독촉까지 한 덱으로 보여 줄 뿐, 전부 반복 재생 장면입니다
          </p>
          <DuelConceptPlayground />
        </section>
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
                        {item.detail.steps.map((s, i) => (
                          <p key={s} className={`text-xs ${i === item.detail.steps!.length - 1 && s.startsWith("💡") ? "text-yellow-400/80" : "text-blue-400"}`}>{s}</p>
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
              a: "시작하고 설문 참여 같은 기본 흐름은 무료로 시작해요. 시뮬레이션 토큰을 쓰며 고수 선택픽을 여는 장치가 들어 있고, 유료 과금 계획이 생기면 사전 공지합니다.",
            },
            {
              q: "매일 해야 하나요? 빠지면 불이익이 있나요?",
              a: "전혀요. 빠진 날은 그냥 기록이 없는 것뿐이에요. 가능한 날만 참여해도 되고, 참여할수록 내 누적 정확도가 쌓이는 구조라 부담 없이 시작할 수 있어요.",
            },
            {
              q: "정확도가 낮으면 어떻게 되나요?",
              a: "서비스 이용에는 아무 제한이 없어요. 다만 정확도가 낮으면 고수 강화예측에 반영되는 내 가중치가 낮아지고, 높으면 커뮤니티 예측에 내 의견이 더 많이 반영됩니다. 잘 못 맞춰도 계속 참여하는 것 자체가 의미 있어요.",
            },
            {
              q: "이걸로 실제 투자 결정을 해도 되나요?",
              a: "본 서비스는 투자 조언이 아닙니다. 집단 예측 데이터를 재미로 확인하는 서비스예요. 실제 투자 결정은 반드시 본인의 판단과 책임 하에 하세요.",
            },
            {
              q: "고수 강화예측은 언제부터 믿을 수 있나요?",
              a: "참여자가 많고 누적 데이터가 쌓일수록 신뢰도가 올라갑니다. 잘 맞추는 사람의 의견은 더 크게, 항상 틀리는 사람의 의견은 반대 방향으로 반영되기 때문에 단순 다수결보다 정교해요.",
            },
            {
              q: "예측 결과가 조작될 수 있나요?",
              a: "장 마감 후 코스피 등락은 외부 금융 데이터(yfinance)에서 자동으로 가져옵니다. 운영자가 임의로 결과를 수정할 수 없는 구조예요.",
            },
            {
              q: "개인정보가 수집되나요?",
              a: "소셜 로그인 시 이름·이메일이 저장됩니다. 채팅 내용·연락처·위치는 수집하지 않아요. 자세한 내용은 하단 개인정보처리방침을 확인해 주세요.",
            },
            {
              q: "알림은 어떻게 받나요?",
              a: "로그인 후 설정 페이지에서 '브라우저 알림 허용'을 탭하면 바로 연결돼요. 매일 밤 22:00에 알림이 오고, 탭하면 설문 페이지로 이동해요. 앱 설치 없이 바로 사용 가능합니다.",
            },
            {
              q: "텔레그램이 꼭 필요한가요?",
              a: "아니에요! 브라우저 알림만으로 충분해요. 텔레그램은 선택 사항이에요. 매번 앱을 열기 귀찮다면 텔레그램 봇을 연결하면 메시지에서 바로 참여할 수 있어서 더 편리하긴 해요.",
            },
            {
              q: "알림이 안 와요",
              a: "① 설정 → 브라우저 알림이 '연동됨'인지 확인해주세요. ② 기기 설정에서 브라우저 알림이 허용돼 있는지 확인해주세요. ③ iPhone은 Safari에서 홈 화면에 추가 후 알림이 작동해요. 해결이 안 되면 forsmartonly@gmail.com으로 문의해 주세요.",
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
