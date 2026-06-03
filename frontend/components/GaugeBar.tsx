"use client";

import { useCallback, useId, useRef, useState } from "react";
import { ChipAmount } from "@/components/ChipAmount";
interface GaugeBarProps {
  value: number; // -100 ~ +100 (0 제외)
  onChange: (v: number) => void;
  tokens: number; // 현재 보유 칩
  disabled?: boolean;
  /** true면 상승/하락 방향 유지(확신도만 조정) */
  lockDirection?: boolean;
  /** false면 안내 숨김 · 생략 시 조작/읽기 전용 각각 맞는 짧은 안내 표시 */
  beginnerTips?: boolean;
}

function calcBet(gauge: number, tokens: number) {
  return Math.max(1, Math.round((Math.abs(gauge) / 100) * tokens));
}

/** 슬라이더 양끝·중앙만 표시해 세로 공간 절약 */
const GAUGE_TICKS: { v: number; color: string }[] = [
  { v: -100, color: "text-blue-400/90" },
  { v: 0, color: "text-gray-500" },
  { v: 100, color: "text-red-400/90" },
];

function formatGaugeTick(v: number): string {
  if (v === 0) return "0";
  return v > 0 ? `+${v}` : `${v}`;
}

/** 썸이 트랙 끝에서 잘리지 않도록 좌우 여백(반지름) */
const THUMB_SIZE_PX = 24;
const THUMB_INSET_PX = THUMB_SIZE_PX / 2;

/** -100~+100 → 패딩 반영된 가로 위치(썸 중심) */
function gaugePositionCss(value: number): string {
  const t = Math.min(100, Math.max(-100, value));
  const ratio = (50 + t / 2) / 100;
  return `calc(${THUMB_INSET_PX}px + (100% - ${THUMB_SIZE_PX}px) * ${ratio})`;
}

function valueFromClientX(rect: DOMRect, clientX: number): number {
  const innerW = rect.width - THUMB_SIZE_PX;
  if (innerW <= 0) return 0;
  const x = clientX - rect.left - THUMB_INSET_PX;
  const f = Math.min(1, Math.max(0, x / innerW));
  let v = Math.round(f * 200 - 100);
  if (v > 100) v = 100;
  if (v < -100) v = -100;
  if (v === 0) v = f >= 0.5 ? 1 : -1;
  return v;
}

function clampGaugeToDirection(v: number, anchor: number): number {
  if (anchor > 0) {
    if (v <= 0) return Math.max(1, Math.abs(v) || 1);
    return v;
  }
  if (anchor < 0) {
    if (v >= 0) return -Math.max(1, Math.abs(v) || 1);
    return v;
  }
  return v;
}

export default function GaugeBar({
  value,
  onChange,
  tokens,
  disabled = false,
  lockDirection = false,
  beginnerTips,
}: GaugeBarProps) {
  const tipsEnabled = beginnerTips !== false;
  const tipsInteractive = tipsEnabled && !disabled;
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const isUp = value > 0;
  const abs = Math.abs(value);
  const bet = calcBet(value, tokens);
  const hitBalance = tokens + bet;

  const applyPointerX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || disabled) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= THUMB_SIZE_PX) return;
      let next = valueFromClientX(rect, clientX);
      if (lockDirection) next = clampGaugeToDirection(next, value);
      onChange(next);
    },
    [disabled, lockDirection, onChange, value],
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

  const halfSpanPct = (abs / 100) * 50;
  const barTransition = dragging ? "none" : "all 150ms ease-out";

  const dirLabel = isUp ? "상승" : "하락";
  const dirColor = isUp ? "text-red-400" : "text-blue-400";

  const helpIdRaw = useId();
  const helpId = helpIdRaw.includes(":") ? helpIdRaw.replace(/:/g, "") : helpIdRaw;

  return (
    <div className="w-full max-w-full min-w-0 box-border bg-[#1A1A1A] border border-amber-500/25 rounded-xl px-3 sm:px-4 py-3 space-y-2.5">
      {tipsInteractive && (
        <div className="space-y-1.5 pb-1.5 border-b border-[#2A2A2A] w-full min-w-0">
          <p id={helpId} className="text-sm text-gray-400 leading-snug">
            막대 <strong className="text-blue-400">왼쪽</strong>=하락 · <strong className="text-red-400">오른쪽</strong>
            =상승
          </p>
          <details className="group rounded-lg bg-[#111]/90 border border-[#2a2a2a] px-3 py-2">
            <summary className="text-sm font-bold text-cyan-400 cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center gap-1">
              <span>확신도·칩 자세히</span>
              <span className="text-gray-600 group-open:rotate-180 transition-transform text-xs">▼</span>
            </summary>
            <div className="mt-1.5 text-sm text-gray-500 leading-relaxed space-y-1.5 pb-0.5 w-full min-w-0">
              <p>
                ±숫자는 <strong className="text-gray-300">확신도</strong>이며 등락률 예측이 아닙니다.
              </p>
              <p>
                <strong className="text-gray-400">배팅 칩</strong>은 확신도·보유량에 따라 자동 산출됩니다.
              </p>
            </div>
          </details>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 min-h-[2rem]">
        <p className="text-sm sm:text-base font-bold text-amber-100/90 leading-snug min-w-0">
          방향과 확신도로 예측하세요
        </p>
        <div className={`flex items-baseline gap-2.5 shrink-0 tabular-nums ${dirColor}`}>
          <span className="text-base sm:text-lg font-black whitespace-nowrap">
            <span className="text-gray-500 font-bold text-xs mr-1">방향</span>
            {dirLabel}
          </span>
          <span className="text-xl sm:text-2xl font-black leading-none whitespace-nowrap">
            <span className="text-gray-500 font-bold text-xs mr-0.5">확신</span>
            {isUp ? "+" : ""}
            {value}
          </span>
        </div>
      </div>

      <div
        ref={trackRef}
        role="slider"
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-disabled={disabled}
        aria-label="코스피 상승·하락 방향과 확신도, 좌측 하락 우측 상승"
        aria-describedby={tipsInteractive ? helpId : undefined}
        className={`select-none relative px-2 py-1 -mx-0.5 rounded-xl ${
          disabled ? "opacity-50 pointer-events-none" : "cursor-grab active:cursor-grabbing"
        }`}
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="relative h-4 mb-1" aria-hidden>
          {GAUGE_TICKS.map(({ v, color }) => (
            <span
              key={v}
              className={`absolute bottom-0 -translate-x-1/2 text-xs tabular-nums leading-none ${color}`}
              style={{ left: gaugePositionCss(v) }}
            >
              {formatGaugeTick(v)}
            </span>
          ))}
        </div>

        <div className="relative flex items-center h-4">
          <div className="relative h-3.5 w-full rounded-full overflow-hidden border border-[#3a3a3a]/90 bg-[#0a0a0c] shadow-[inset_0_1px_6px_rgba(0,0,0,.6)]">
            {isUp ? (
              <div
                className="absolute inset-y-0 left-1/2 rounded-r-full bg-gradient-to-r from-red-950/80 via-red-600 to-red-400/95"
                style={{ width: `${halfSpanPct}%`, transition: barTransition }}
              />
            ) : (
              <div
                className="absolute inset-y-0 right-1/2 rounded-l-full bg-gradient-to-l from-blue-950/80 via-blue-600 to-blue-400/95"
                style={{ width: `${halfSpanPct}%`, transition: barTransition }}
              />
            )}
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/20" />
          </div>

          <div
            className="pointer-events-none absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ left: gaugePositionCss(value), transition: barTransition }}
          >
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 bg-[#1a1a1a] shadow-md ${
                isUp ? "border-red-300/90" : "border-blue-300/90"
              } ${dragging ? "scale-110" : ""}`}
            >
              <span className={`block h-2 w-2 rounded-full ${isUp ? "bg-red-400" : "bg-blue-400"}`} />
            </div>
          </div>
        </div>

        <div className="flex justify-between text-xs font-bold mt-0.5 px-0.5">
          <span className="text-blue-400">하락</span>
          <span className="text-red-400">상승</span>
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2">
        <p className="text-xs font-bold text-amber-200/80 mb-1.5">자산</p>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-sm">
          <div className="flex justify-between items-center gap-1 min-w-0">
            <span className="text-gray-500 font-bold text-xs sm:text-sm shrink-0">보유금액</span>
            <ChipAmount amount={tokens} className="text-white font-black shrink-0" />
          </div>
          <div className="flex justify-between items-center gap-1 min-w-0">
            <span className="text-gray-500 font-bold text-xs sm:text-sm shrink-0">배팅금액</span>
            <ChipAmount amount={bet} className={`font-black shrink-0 ${dirColor}`} />
          </div>
          <div className="flex justify-between items-center gap-1 min-w-0">
            <span className="text-gray-500 font-bold text-xs sm:text-sm shrink-0">적중시 자산</span>
            <ChipAmount amount={hitBalance} className="text-green-400 font-black shrink-0" />
          </div>
          <div className="flex justify-between items-center gap-1 min-w-0">
            <span className="text-gray-500 font-bold text-xs sm:text-sm shrink-0">실패시 자산</span>
            <ChipAmount amount={Math.max(0, tokens - bet)} className="text-red-400 font-black shrink-0" />
          </div>
        </div>
      </div>

      {tipsEnabled ? (
        <p className="text-xs text-gray-500 leading-snug pt-1 border-t border-[#2A2A2A]">
          등락률이 아닌 <span className="text-gray-400">방향·확신도</span>입니다.
        </p>
      ) : null}
    </div>
  );
}
