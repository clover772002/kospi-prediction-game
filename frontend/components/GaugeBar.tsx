"use client";

import { useCallback, useRef, useState } from "react";

interface GaugeBarProps {
  value: number;           // -100 ~ +100 (0 제외)
  onChange: (v: number) => void;
  tokens: number;          // 현재 보유 토큰
  disabled?: boolean;
}

function calcBet(gauge: number, tokens: number) {
  return Math.max(1, Math.round((Math.abs(gauge) / 100) * tokens));
}

/** 트랙 좌표(왼쪽 0 ~ 오른쪽 1) → -100..100 (0 불가) */
function valueFromTrackFraction(f: number): number {
  const clamped = Math.min(1, Math.max(0, f));
  let v = Math.round((clamped - 0.5) * 200);
  if (v > 100) v = 100;
  if (v < -100) v = -100;
  if (v === 0) v = clamped >= 0.5 ? 1 : -1;
  return v;
}

export default function GaugeBar({ value, onChange, tokens, disabled = false }: GaugeBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

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

  const applyPointerX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || disabled) return;
      const rect = el.getBoundingClientRect();
      const w = rect.width;
      if (w <= 0) return;
      const f = (clientX - rect.left) / w;
      const next = valueFromTrackFraction(f);
      onChange(next);
    },
    [disabled, onChange],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      draggingRef.current = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      applyPointerX(e.clientX);
    },
    [disabled, applyPointerX],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || disabled) return;
      applyPointerX(e.clientX);
    },
    [disabled, applyPointerX],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* 이미 해제됨 */
    }
  }, []);

  // 중앙(50%)에서 바깥으로 채움: +는 오른쪽 반칸, -는 왼쪽 반칸
  const halfSpanPct = (abs / 100) * 50;
  const barTransition = dragging ? "none" : "all 150ms ease-out";

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

      {/* 드래그 가능 게이지: 터치 영역 확대 */}
      <div
        className={`select-none rounded-xl py-3 -my-1 ${disabled ? "" : "cursor-grab active:cursor-grabbing"}`}
        style={{ touchAction: "none" }}
      >
        <div
          ref={trackRef}
          role="slider"
          aria-valuemin={-100}
          aria-valuemax={100}
          aria-valuenow={value}
          aria-disabled={disabled}
          aria-label="확신도 게이지, 드래그하여 조정"
          className={`relative h-8 w-full rounded-full bg-[#1A1A1A] overflow-hidden border border-[#2A2A2A] ${disabled ? "opacity-50 pointer-events-none" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {isUp ? (
            <div
              className="absolute top-0 left-1/2 h-full bg-red-500"
              style={{ width: `${halfSpanPct}%`, transition: barTransition }}
            />
          ) : (
            <div
              className="absolute top-0 h-full bg-blue-500"
              style={{
                right: "50%",
                width: `${halfSpanPct}%`,
                transition: barTransition,
              }}
            />
          )}
          <div className="absolute left-1/2 top-0 z-10 h-full w-0.5 bg-[#333] -translate-x-1/2 pointer-events-none" />
          <div
            className={`absolute top-1/2 z-20 -translate-y-1/2 w-5 h-5 rounded-full border-2 shadow-lg pointer-events-none ${isUp ? "bg-red-400 border-red-300" : "bg-blue-400 border-blue-300"}`}
            style={{
              left: `calc(${50 + value / 2}% - 10px)`,
              transition: barTransition,
            }}
          />
        </div>
        {!disabled && (
          <p className="text-center text-[10px] text-gray-500 mt-2">막대를 눌러 드래그하면 1% 단위로 미세 조정할 수 있어요</p>
        )}
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
              type="button"
              onClick={() => allIn(-1)}
              disabled={disabled}
              className="flex-1 py-2 rounded-xl bg-[#111] border border-blue-500/30 text-blue-400 text-[10px] font-black hover:bg-blue-500/10 active:scale-95 transition-all disabled:opacity-30"
            >
              올인
            </button>
            <button
              type="button"
              onClick={() => move(-10)}
              disabled={disabled}
              className="flex-1 py-2 rounded-xl bg-[#111] border border-blue-500/20 text-blue-300 text-xs font-black hover:bg-blue-500/10 active:scale-95 transition-all disabled:opacity-30"
            >
              -10
            </button>
            <button
              type="button"
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
              type="button"
              onClick={() => move(1)}
              disabled={disabled}
              className="flex-1 py-2 rounded-xl bg-[#111] border border-red-500/20 text-red-300 text-xs font-black hover:bg-red-500/10 active:scale-95 transition-all disabled:opacity-30"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => move(10)}
              disabled={disabled}
              className="flex-1 py-2 rounded-xl bg-[#111] border border-red-500/20 text-red-300 text-xs font-black hover:bg-red-500/10 active:scale-95 transition-all disabled:opacity-30"
            >
              +10
            </button>
            <button
              type="button"
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
