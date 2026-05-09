"use client";

import { useCallback } from "react";

interface GaugeBarProps {
  value: number;           // -100 ~ +100 (0 제외)
  onChange: (v: number) => void;
  tokens: number;          // 현재 보유 토큰
  disabled?: boolean;
}

function calcBet(gauge: number, tokens: number) {
  return Math.max(1, Math.round((Math.abs(gauge) / 100) * tokens));
}

export default function GaugeBar({ value, onChange, tokens, disabled = false }: GaugeBarProps) {
  const isUp = value > 0;
  const abs = Math.abs(value);
  const bet = calcBet(value, tokens);

  const move = useCallback((delta: number) => {
    if (disabled) return;
    let next = value + delta;
    // 0을 건너뜀
    if (value < 0 && next >= 0) next = delta > 0 ? 1 : -1;
    if (value > 0 && next <= 0) next = delta < 0 ? -1 : 1;
    next = Math.max(-100, Math.min(100, next));
    if (next === 0) next = delta > 0 ? 1 : -1;
    onChange(next);
  }, [value, onChange, disabled]);

  const allIn = useCallback((direction: 1 | -1) => {
    if (disabled) return;
    onChange(direction * 100);
  }, [onChange, disabled]);

  // 게이지 바 너비 (좌: 하락 파랑, 우: 상승 빨강)
  const leftPct  = isUp ? 0 : abs;   // 하락 방향 채움
  const rightPct = isUp ? abs : 0;   // 상승 방향 채움

  const dirLabel  = isUp ? "📈 상승" : "📉 하락";
  const dirColor  = isUp ? "text-red-400" : "text-blue-400";
  const borderCls = isUp ? "border-red-500/40" : "border-blue-500/40";
  const bgGlow    = isUp ? "bg-red-500/5" : "bg-blue-500/5";

  return (
    <div className={`rounded-2xl border ${borderCls} ${bgGlow} p-5 space-y-4`}>
      {/* 방향 + 게이지 수치 */}
      <div className="flex items-center justify-between">
        <span className={`text-xl font-black ${dirColor}`}>{dirLabel}</span>
        <span className={`text-2xl font-black tabular-nums ${dirColor}`}>
          {isUp ? "+" : ""}{value}%
        </span>
      </div>

      {/* 게이지 바 */}
      <div className="relative h-8 bg-[#1A1A1A] rounded-full overflow-hidden border border-[#2A2A2A]">
        {/* 하락 (파랑, 왼쪽 채움) */}
        <div
          className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-150"
          style={{ width: `${leftPct / 2}%` }}
        />
        {/* 상승 (빨강, 오른쪽 채움) */}
        <div
          className="absolute right-0 top-0 h-full bg-red-500 transition-all duration-150"
          style={{ width: `${rightPct / 2}%` }}
        />
        {/* 중앙선 */}
        <div className="absolute left-1/2 top-0 h-full w-0.5 bg-[#333] -translate-x-1/2" />
        {/* 현재 위치 핸들 */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 shadow-lg transition-all duration-150 ${isUp ? "bg-red-400 border-red-300" : "bg-blue-400 border-blue-300"}`}
          style={{ left: `calc(${50 + value / 2}% - 10px)` }}
        />
      </div>

      {/* -100 / 0 / +100 라벨 */}
      <div className="flex justify-between text-[10px] text-gray-600 px-1">
        <span>-100%</span>
        <span>0</span>
        <span>+100%</span>
      </div>

      {/* 조작 버튼 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 하락 방향 */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] text-blue-400 font-bold text-center">📉 하락</p>
          <div className="flex gap-1">
            <button
              onClick={() => allIn(-1)}
              disabled={disabled}
              className="flex-1 py-2 rounded-xl bg-[#111] border border-blue-500/30 text-blue-400 text-[10px] font-black hover:bg-blue-500/10 active:scale-95 transition-all disabled:opacity-30"
            >
              올인
            </button>
            <button
              onClick={() => move(-10)}
              disabled={disabled}
              className="flex-1 py-2 rounded-xl bg-[#111] border border-blue-500/20 text-blue-300 text-xs font-black hover:bg-blue-500/10 active:scale-95 transition-all disabled:opacity-30"
            >
              -10
            </button>
            <button
              onClick={() => move(-1)}
              disabled={disabled}
              className="flex-1 py-2 rounded-xl bg-[#111] border border-blue-500/20 text-blue-300 text-xs font-black hover:bg-blue-500/10 active:scale-95 transition-all disabled:opacity-30"
            >
              -1
            </button>
          </div>
        </div>

        {/* 상승 방향 */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] text-red-400 font-bold text-center">📈 상승</p>
          <div className="flex gap-1">
            <button
              onClick={() => move(1)}
              disabled={disabled}
              className="flex-1 py-2 rounded-xl bg-[#111] border border-red-500/20 text-red-300 text-xs font-black hover:bg-red-500/10 active:scale-95 transition-all disabled:opacity-30"
            >
              +1
            </button>
            <button
              onClick={() => move(10)}
              disabled={disabled}
              className="flex-1 py-2 rounded-xl bg-[#111] border border-red-500/20 text-red-300 text-xs font-black hover:bg-red-500/10 active:scale-95 transition-all disabled:opacity-30"
            >
              +10
            </button>
            <button
              onClick={() => allIn(1)}
              disabled={disabled}
              className="flex-1 py-2 rounded-xl bg-[#111] border border-red-500/30 text-red-400 text-[10px] font-black hover:bg-red-500/10 active:scale-95 transition-all disabled:opacity-30"
            >
              올인
            </button>
          </div>
        </div>
      </div>

      {/* 배팅 정보 */}
      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">보유 토큰</span>
          <span className="text-white font-bold tabular-nums">💰 {tokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">배팅액</span>
          <span className={`font-black tabular-nums ${dirColor}`}>{bet.toLocaleString()} 토큰</span>
        </div>
        <div className="h-px bg-[#222]" />
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">적중 시</span>
          <span className="text-green-400 font-bold">배당 × 집단반응</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">실패 시</span>
          <span className="text-red-400 font-bold">-{bet.toLocaleString()} 토큰</span>
        </div>
      </div>
    </div>
  );
}
