"use client";

import { useEffect, useState } from "react";

/** 로그인 전용: 설문 이후 대결·순위·토큰 흐름 예시 (데모 수치, 반복 재생) */
export default function DuelConceptPlayground() {
  const [tick, setTick] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      setStepIdx((s) => (s + 1) % 3);
    }, 850);
    return () => window.clearInterval(id);
  }, []);

  const t = tick * 0.09;
  const fakeRank = 80 + Math.round(Math.sin(t) * 35);
  const clampedRank = Math.min(199, Math.max(12, fakeRank));
  const myAcc = 52 + Math.round(Math.sin(t * 1.3) * 8);
  const oppAcc = 54 + Math.round(Math.cos(t * 1.1) * 9);
  const tokens = 842 + Math.round(Math.sin(t * 0.7) * 120);

  const leaderboard = [
    { n: "고수***", pct: 78, hue: "text-amber-400" },
    { n: "불패***", pct: 71, hue: "text-yellow-500" },
    { n: "역지***", pct: 63, hue: "text-orange-400" },
    { n: "나예***", pct: myAcc, hue: "text-cyan-400", self: true as const },
    { n: "초삽***", pct: 58, hue: "text-gray-400" },
  ];

  const spotlight = tick % leaderboard.length;

  return (
    <div
      className="w-full rounded-2xl border border-dashed border-violet-500/40 bg-gradient-to-b from-violet-950/30 to-[#121212]/95 overflow-hidden"
      aria-hidden
    >
      <div className="flex justify-between gap-2 px-3 py-2 bg-violet-500/15 border-b border-violet-500/25 items-center flex-wrap">
        <span className="text-[10px] font-black text-violet-300 tracking-wide">설문 다음엔 이렇게 쓰입니다</span>
        <span className="text-[10px] text-gray-600">예시 장면 반복 재생 · 데모</span>
      </div>

      <div className="p-3 space-y-4">
        {/* 타임라인 3단계 */}
        <div className="flex justify-between gap-1 relative">
          <div className="absolute top-[22px] left-[12%] right-[12%] h-px bg-[#333] z-0" />
          {[
            { emoji: "📝", label: "예측 저장", sub: "확신·토큰" },
            { emoji: "🎯", label: "장 마감", sub: "적중 판정" },
            { emoji: "⚔️", label: "대결·순위", sub: "승패·연승" },
          ].map((s, i) => (
            <div key={s.label} className="relative z-10 flex-1 flex flex-col items-center text-center gap-1">
              <div
                className={`duel-step-chip w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all duration-300 border ${
                  stepIdx === i
                    ? "bg-violet-600/90 border-violet-400 duel-step-active-scale shadow-[0_0_18px_rgba(139,92,246,.45)]"
                    : "bg-[#1a1a1a] border-[#333] opacity-50"
                }`}
              >
                {s.emoji}
              </div>
              <span className={`text-[9px] font-bold ${stepIdx === i ? "text-white" : "text-gray-600"}`}>{s.label}</span>
              <span className="text-[8px] text-gray-600 leading-none">{s.sub}</span>
            </div>
          ))}
        </div>

        {/* VS 카드 */}
        <div className="relative rounded-2xl bg-[#0f0f11] border border-[#2a2a2e] px-3 py-3 overflow-hidden">
          <div className="absolute inset-0 duel-bg-orbit opacity-90 pointer-events-none" />
          <div className="relative flex items-center gap-2">
            <div
              className={`flex-1 rounded-xl border px-3 py-2 transition-all duration-300 ${
                Math.sin(t) > 0 ? "border-cyan-500/50 bg-cyan-500/10 shadow-[0_0_14px_rgba(34,211,238,.2)]" : "border-[#333] bg-[#151515]"
              }`}
            >
              <p className="text-[9px] text-gray-500 font-bold mb-0.5">나</p>
              <p className="text-lg font-black text-white tabular-nums">{myAcc}%</p>
              <p className="text-[8px] text-gray-600">예시 적중</p>
            </div>

            <div className="duel-vs-icon text-3xl shrink-0 select-none">⚔️</div>

            <div
              className={`flex-1 rounded-xl border px-3 py-2 transition-all duration-300 ${
                Math.sin(t) <= 0 ? "border-orange-500/50 bg-orange-500/10 shadow-[0_0_14px_rgba(251,146,60,.18)]" : "border-[#333] bg-[#151515]"
              }`}
            >
              <p className="text-[9px] text-gray-500 font-bold mb-0.5">상대(순위권)</p>
              <p className="text-lg font-black text-orange-300 tabular-nums">{oppAcc}%</p>
              <p className="text-[8px] text-orange-400/70">⚔ 대결 신청 시 맞춤</p>
            </div>
          </div>

          <div className="relative mt-2 flex justify-between items-center text-[10px] text-gray-500 px-1">
            <span>전국 순위 예시 ·</span>
            <span className="tabular-nums text-violet-300 font-black">{clampedRank}위 근처</span>
          </div>
          <div className="relative mt-1 h-1.5 rounded-full bg-[#222] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-500 rounded-full duel-rank-fill"
              style={{ width: `${100 - clampedRank / 2}%` }}
            />
          </div>
        </div>

        {/* 토큰·스트릭 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 flex flex-col duel-token-pulse">
            <span className="text-[9px] text-amber-200/90 font-bold">보유 토큰 예시</span>
            <span className="text-xl font-black text-amber-300 tabular-nums">💰 {tokens.toLocaleString()}</span>
            <span className="text-[8px] text-gray-600 mt-0.5">설문 확신·적중 규칙 반영</span>
          </div>
          <div className="rounded-xl border border-orange-500/25 bg-orange-950/20 px-3 py-2 flex flex-col justify-center duel-streak-fire">
            <span className="text-[9px] text-orange-400 font-bold">연속 적중</span>
            <span className="text-lg font-black text-white tabular-nums">🔥 {(3 + (tick % 4)).toString()}연승</span>
            <span className="text-[8px] text-gray-600">배당 보너스 연계</span>
          </div>
        </div>

        {/* 미니 리더보드 */}
        <div className="rounded-xl border border-[#2a2a2e] bg-[#111]/90 overflow-hidden">
          <div className="px-3 py-1.5 border-b border-[#222] flex justify-between items-center bg-[#141414]">
            <span className="text-[10px] font-black text-gray-400">🏆 전국대결 순위 예시</span>
            <span className="text-[9px] text-gray-600">줄 순회 하이라이트</span>
          </div>
          <div className="divide-y divide-[#222]">
            {leaderboard.map((row, idx) => (
              <div
                key={row.n}
                className={`flex items-center gap-3 px-3 py-2 text-xs transition-colors duration-300 ${
                  spotlight === idx ? "bg-violet-500/15 duel-row-pop" : "bg-transparent"
                }`}
              >
                <span className="tabular-nums w-7 text-gray-600 font-black">{idx + 1}</span>
                <span className={`flex-1 font-bold truncate ${row.self ? row.hue + " duel-name-glow" : "text-gray-400"}`}>
                  {row.n}
                  {row.self ? (
                    <span className="ml-1 text-[8px] text-cyan-500 font-black">YOU</span>
                  ) : null}
                </span>
                <span className={`font-black tabular-nums ${row.hue}`}>{row.pct}%</span>
                {spotlight === idx ? (
                  <span className="text-[10px] text-violet-400 font-black animate-pulse">◀</span>
                ) : (
                  <span className="w-4 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 그룹 알림 카드 미니 */}
        <div className="relative rounded-xl border border-green-500/25 bg-green-950/20 px-3 py-2 duel-nudge-slide">
          <div className="flex items-start gap-2">
            <span className="text-lg duel-bell-shake">🔔</span>
            <div className="min-w-0">
              <p className="text-[10px] text-green-400 font-black">데모 · 그룹 독촉장 예시</p>
              <p className="text-[11px] text-gray-300 mt-1 leading-snug">
                같은 방 친구가 설문 빨리 참여하게 돌촉 → <strong className="text-white">내 대결·순위</strong> 재미가 붙어요.
              </p>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-center text-gray-600 px-2 leading-relaxed">
          로그인 후 <strong className="text-gray-400">대시보드</strong>에서 대결 신청 · 전국 순위 · 그룹이 열립니다. 위 표시는 이해 돕기용 가짜 수치예요.
        </p>
      </div>
    </div>
  );
}
