"use client";

import { useEffect, useState } from "react";

const PHASE_MS = 640;
/** 반복 데모: 내가 고수에게 보내는 텍스트마다 토큰 차감 · 고수 답변은 토큰 없음 */
const N_PHASE = 7;

/** 로그인 랜딩: 고수와의 토큰 메시지 컨셉 (반복 재생) */
export default function ExpertMessageConceptPlayground() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setPhase((p) => (p + 1) % N_PHASE), PHASE_MS);
    return () => window.clearInterval(id);
  }, []);

  const busyLine = phase >= 1;
  const showMyBubble = phase >= 1;
  const myBubbleVivid = phase >= 2;
  const showSpendHint = phase === 3;
  const showExpertTyping = phase === 4;
  const showExpertBubble = phase >= 5;

  const legendStrong = phase === 6 || phase === 0;

  return (
    <div className="w-full rounded-2xl border border-sky-500/35 bg-gradient-to-b from-[#0c1218]/95 to-[#0e0e10] overflow-hidden shadow-[inset_0_1px_0_rgba(56,189,248,0.08)]">
      <div className="flex justify-between gap-2 px-3 py-2 bg-sky-500/10 border-b border-sky-500/20 items-center flex-wrap">
        <span className="text-[10px] font-black text-sky-200/95 tracking-wide uppercase">토큰 · 고수 메시지</span>
        <span className="text-[10px] text-gray-600">반복 데모 · 터치 없음</span>
      </div>

      <div className="relative px-3 py-3 min-h-[12.5rem]">
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/[0.06] via-transparent to-amber-500/[0.04] transition-opacity duration-500 ${
            legendStrong ? "opacity-95" : "opacity-55"
          }`}
          aria-hidden
        />

        <div className="relative z-[1] flex flex-col gap-2">
          <p className="text-[10px] text-gray-500 text-center font-bold px-2">
            {busyLine ? "내가 보내는 글 한 번마다 · 고수에게만 토큰이 붙습니다" : "설문 적중 등으로 번 토큰으로 질문 한 통씩"}
          </p>

          {/* 내 메시지 (우측) */}
          <div
            className={`flex flex-col items-end gap-1 pr-1 transition-all duration-500 ${
              showMyBubble ? (myBubbleVivid ? "opacity-100 translate-y-0" : "opacity-55 translate-y-0.5") : "opacity-0 translate-y-1 pointer-events-none"
            }`}
          >
            <div className="inline-flex items-center gap-1.5 max-w-[92%]">
              <span className="text-[9px] font-black uppercase tracking-wide text-gray-600">나</span>
              <div className="rounded-2xl rounded-tr-md border border-sky-500/35 bg-sky-950/40 px-3 py-2 text-left shadow-sm">
                <p className="text-[11px] text-gray-100 leading-snug font-medium">
                  내일 변동 크게 보나요? 한 줄만요.
                </p>
              </div>
            </div>
            {showSpendHint ? (
              <span className="text-[10px] font-black text-amber-300 tabular-nums drop-shadow-[0_0_8px_rgba(251,191,36,.25)] animate-pulse mr-14">
                질문 1통 · −3 💰
              </span>
            ) : (
              myBubbleVivid &&
              phase >= 4 && (
                <span className="text-[9px] font-bold text-gray-600 mr-1">발송당 토큰 차감 (예시 숫자)</span>
              )
            )}
          </div>

          {/* 고수 답변 (좌측) */}
          <div className="mt-2 space-y-1.5 min-h-[4.75rem]">
            {showExpertTyping && !showExpertBubble ? (
              <div className="flex items-center gap-2 px-2">
                <span className="text-lg">⭐</span>
                <span className="text-[11px] text-gray-500 font-bold tracking-tight animate-pulse">고수가 답장을 작성 중…</span>
              </div>
            ) : null}

            <div
              className={`flex flex-col items-start gap-1 pl-1 transition-all duration-500 ${
                showExpertBubble ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none h-0 overflow-hidden"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] font-black text-yellow-400/95 uppercase tracking-wide">⭐ 고수</span>
                <span className="text-[9px] font-black rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-emerald-300/95">
                  답장은 토큰 0
                </span>
              </div>
              <div className="rounded-2xl rounded-tl-md border border-white/[0.1] bg-[#151518]/95 px-3 py-2 max-w-[92%]">
                <p className="text-[11px] text-gray-300 leading-snug">
                  큰 레인지만 조심. 나머지는 장 흐름 보고 판단하세요.
                </p>
              </div>
            </div>
          </div>

          {/* 하단 규칙 */}
          <div
            className={`mt-3 mx-1 rounded-xl border px-3 py-2 transition-all duration-300 ${
              legendStrong ? "border-sky-500/35 bg-sky-500/[0.08]" : "border-white/[0.06] bg-black/25"
            }`}
          >
            <p className="text-[10px] text-gray-400 leading-relaxed text-center font-bold">
              <span className="text-sky-200/95">내가 「보내기」할 때만</span> 토큰이 나가고,{" "}
              <span className="text-emerald-300/90">고수가 읽거나 답해도 토큰을 쓰지 않습니다.</span>
            </p>
            <p className="text-[9px] text-gray-600 text-center mt-1">실제 차감 규모는 서비스 정책에 따라 달라질 수 있어요.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
