"use client";

import { useCallback, useId, useRef, useState } from "react";

interface GaugeBarProps {
  value: number;           // -100 ~ +100 (0 제외)
  onChange: (v: number) => void;
  tokens: number;          // 현재 보유 토큰
  disabled?: boolean;
  /** false면 안내 숨김 · 생략 시 조작/읽기 전용 각각 맞는 짧은 안내 표시 */
  beginnerTips?: boolean;
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

export default function GaugeBar({
  value,
  onChange,
  tokens,
  disabled = false,
  beginnerTips,
}: GaugeBarProps) {
  const tipsEnabled = beginnerTips !== false;
  const tipsInteractive = tipsEnabled && !disabled;
  const tipsReadonly = tipsEnabled && disabled;
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

  const helpIdRaw = useId();
  const helpId = helpIdRaw.includes(":") ? helpIdRaw.replace(/:/g, "") : helpIdRaw;

  return (
    <div className={`w-full max-w-full min-w-0 rounded-2xl border ${borderCls} ${bgGlow} px-4 py-5 sm:px-5 space-y-4 box-border`}>
      {tipsReadonly && (
        <p className="text-[11px] text-gray-500 leading-snug border-b border-[#2A2A2A] pb-3">
          아래 표시는 <span className="text-gray-400">등락률 예측</span>이 아니라 제출했던 예측의{" "}
          <span className="text-gray-400">방향·확신</span>(배팅 기준)입니다.
        </p>
      )}
      {tipsInteractive && (
        <div className="space-y-2 pb-2 border-b border-[#2A2A2A] w-full min-w-0">
          <p id={helpId} className="text-[11px] text-gray-400 leading-snug">
            <strong className="text-gray-300 font-bold">얼마나 확신하나요?</strong> 내일 장이{" "}
            <strong className="text-red-400 font-bold">오를지</strong>·{" "}
            <strong className="text-blue-400 font-bold">내릴지</strong> 정하고, 그 예측을{" "}
            <strong className="text-gray-300">얼마나 믿는지</strong>를 막대로 표현해요.
            막대를 <strong className="text-blue-400">왼쪽</strong>(하락 예상)·
            <strong className="text-red-400">오른쪽</strong>(상승 예상)으로 움직이면 방향과 확신 정도가 바뀌어요.
          </p>
          <details className="group rounded-xl bg-[#111]/90 border border-[#2a2a2a] px-3 py-2">
            <summary className="text-[11px] text-cyan-400 font-bold cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center gap-1">
              <span>±% 숫자·토큰이 헷갈리면 펼치기</span>
              <span className="text-gray-600 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="mt-2 text-[11px] text-gray-500 leading-relaxed space-y-1.5 pb-1 w-full min-w-0">
              <p>
                <strong className="text-gray-400">얼마나 확신하나요?</strong>에 답하는 값이 ±%로 보일 뿐이에요.{" "}
                <strong className="text-gray-400">±% 숫자</strong>는 코스피가 내일 몇 % 오를지/내릴지를 적는 게{" "}
                <strong className="text-gray-400">아닙니다.</strong>
                같은 말로, 맞았을 때 수익이 몇 %인지와도 무관해요.
              </p>
              <p>
                대신 「그 방향으로 장이 마감될 거라고 <strong className="text-gray-400">얼마나 확신하는지</strong>」를 나타내요.
                말하자면 같은 <strong className="text-gray-400">자신감</strong> 크기를 숫자로 옮긴 거라고 보면 돼요.
              </p>
              <p>
                가운데(0)에 가까울수록 망설이는 쪽, 양쪽 끝에 가까울수록 그 방향에 <strong className="text-gray-400">강하게 확신</strong>하는 쪽이에요.
              </p>
              <p>
                <strong className="text-gray-400">배팅 토큰</strong>은 그 확신 크기와 보유 토큰에 따라 거는 금액이에요. 적중하면 배당 규칙에 따라 받고, 빗나가면 거는 만큼 잃게 됩니다.
              </p>
            </div>
          </details>
        </div>
      )}

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
          aria-label="내일 장 상승·하락 방향과 확신 정도 선택, 좌측 하락 우측 상승"
          aria-describedby={tipsInteractive ? helpId : undefined}
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
          <span className="text-green-400 font-bold">거는 만큼 × 집단배율 × 토큰 아이템 등</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">실패 시</span>
          <span className="text-red-400 font-bold">-{bet.toLocaleString()} 토큰</span>
        </div>
      </div>
    </div>
  );
}
