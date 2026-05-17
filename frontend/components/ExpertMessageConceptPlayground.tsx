"use client";

import { useEffect, useState } from "react";

const PHASE_MS = 640;
const N_PHASE = 7;

/** 로그인 랜딩: 토큰 → 고수 소통 시각 예시 */
export default function ExpertMessageConceptPlayground() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setPhase((p) => (p + 1) % N_PHASE), PHASE_MS);
    return () => window.clearInterval(id);
  }, []);

  const showMyBubble = phase >= 1;
  const myBubbleVivid = phase >= 2;
  const showGiftHint = phase === 3;
  const showExpertTyping = phase === 4;
  const showExpertBubble = phase >= 5;
  const legendStrong = phase === 6 || phase === 0;

  return (
    <div className="w-full rounded-3xl border-2 border-sky-500/35 bg-gradient-to-b from-[#0c1218]/95 to-[#0e0e10] overflow-hidden shadow-[inset_0_1px_0_rgba(56,189,248,0.08)]">
      <div className="flex items-center justify-center px-4 py-2.5 bg-sky-500/10 border-b border-sky-500/20">
        <span className="text-base sm:text-lg font-black text-sky-200/95 tracking-wide">토큰 → 고수 채팅</span>
      </div>

      <div className="relative px-3 py-3 min-h-[11rem]">
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/[0.06] via-transparent to-amber-500/[0.04] transition-opacity duration-500 ${
            legendStrong ? "opacity-95" : "opacity-55"
          }`}
          aria-hidden
        />

        <div className="relative z-[1] flex flex-col gap-2">
          <p className="text-lg sm:text-xl text-gray-400 text-center font-black px-2">토큰 주면 질문 · 답 채팅</p>

          {/* 내 메시지 (우측) */}
          <div
            className={`flex flex-col items-end gap-1 pr-1 transition-all duration-500 ${
              showMyBubble ? (myBubbleVivid ? "opacity-100 translate-y-0" : "opacity-55 translate-y-0.5") : "opacity-0 translate-y-1 pointer-events-none"
            }`}
          >
            <div className="inline-flex items-center gap-1.5 max-w-[92%]">
              <span className="text-sm font-black uppercase tracking-wide text-gray-500">나</span>
              <div className="rounded-2xl rounded-tr-md border border-sky-500/35 bg-sky-950/40 px-3.5 py-3 text-left shadow-sm">
                <p className="text-base sm:text-lg text-gray-100 leading-snug font-medium">
                  내일 변동 크게 보나요? 한 줄만요.
                </p>
              </div>
            </div>
            {showGiftHint ? (
              <span className="text-base font-black text-amber-300 tabular-nums drop-shadow-[0_0_8px_rgba(251,191,36,.25)] animate-pulse mr-10">
                고수에게 +3 💰
              </span>
            ) : null}
          </div>

          {/* 고수 답변 (좌측) */}
          <div className="mt-2 space-y-1.5 min-h-[4.75rem]">
            {showExpertTyping && !showExpertBubble ? (
              <div className="flex items-center gap-2 px-2">
                <span className="text-xl">⭐</span>
                <span className="text-base sm:text-lg text-gray-400 font-black tracking-tight animate-pulse">고수 작성 중…</span>
              </div>
            ) : null}

            <div
              className={`flex flex-col items-start gap-1 pl-1 transition-all duration-500 ${
                showExpertBubble ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none h-0 overflow-hidden"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm sm:text-base font-black text-yellow-400/95 uppercase tracking-wide">⭐ 고수</span>
                <span className="text-sm font-black rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-emerald-300/95">
                  답장 무료
                </span>
              </div>
              <div className="rounded-2xl rounded-tl-md border border-white/[0.1] bg-[#151518]/95 px-3 py-2 max-w-[92%]">
                <p className="text-base sm:text-lg text-gray-300 leading-snug">
                  큰 레인지만 조심. 나머지는 장 흐름 보고 판단하세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
