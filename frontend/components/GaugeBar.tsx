"use client";

import { useCallback, useId, useRef, useState } from "react";

interface GaugeBarProps {
  value: number; // -100 ~ +100 (0 제외)
  onChange: (v: number) => void;
  tokens: number; // 현재 보유 토큰
  disabled?: boolean;
  /** false면 안내 숨김 · 생략 시 조작/읽기 전용 각각 맞는 짧은 안내 표시 */
  beginnerTips?: boolean;
}

function calcBet(gauge: number, tokens: number) {
  return Math.max(1, Math.round((Math.abs(gauge) / 100) * tokens));
}

const GAUGE_TICKS: { v: number; color: string }[] = [
  { v: -100, color: "text-blue-400/90" },
  { v: -50, color: "text-gray-500" },
  { v: -10, color: "text-gray-500" },
  { v: 0, color: "text-gray-500" },
  { v: 10, color: "text-gray-500" },
  { v: 50, color: "text-gray-500" },
  { v: 100, color: "text-red-400/90" },
];

function gaugeTickLeft(v: number): string {
  return `${50 + v / 2}%`;
}

function gaugeTickTransform(v: number): string {
  if (v <= -100) return "translateX(0)";
  if (v >= 100) return "translateX(-100%)";
  return "translateX(-50%)";
}

function formatGaugeTick(v: number): string {
  if (v === 0) return "0";
  return v > 0 ? `+${v}` : `${v}`;
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

  const halfSpanPct = (abs / 100) * 50;
  const barTransition = dragging ? "none" : "all 150ms ease-out";

  const dirLabel = isUp ? "상승" : "하락";
  const dirColor = isUp ? "text-red-400" : "text-blue-400";
  const borderCls = isUp ? "border-red-500/40" : "border-blue-500/40";
  const bgGlow = isUp ? "bg-red-500/5" : "bg-blue-500/5";

  const helpIdRaw = useId();
  const helpId = helpIdRaw.includes(":") ? helpIdRaw.replace(/:/g, "") : helpIdRaw;

  const gaugeDisclaimer = (
    <p className="text-base text-gray-500 leading-snug pt-3 border-t border-[#2A2A2A]">
      아래 표시는 <span className="text-gray-400">등락률 예측</span>이 아니라, 제출하신 예측의{" "}
      <span className="text-gray-400">방향·확신도</span>입니다.
    </p>
  );

  return (
    <div className={`w-full max-w-full min-w-0 rounded-2xl border ${borderCls} ${bgGlow} px-5 py-6 sm:px-6 space-y-4 box-border`}>
      {tipsInteractive && (
        <div className="space-y-2 pb-2 border-b border-[#2A2A2A] w-full min-w-0">
          <p id={helpId} className="text-base text-gray-300 leading-snug">
            막대 <strong className="text-blue-400">왼쪽</strong>=하락·<strong className="text-red-400">오른쪽</strong>
            =상승, 멀수록 그 방향 확신이 큽니다.
          </p>
          <details className="group rounded-xl bg-[#111]/90 border border-[#2a2a2a] px-4 py-2.5">
            <summary className="text-base text-cyan-400 font-bold cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center gap-1">
              <span>확신도·토큰 자세히 보기</span>
              <span className="text-gray-600 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="mt-2 text-base text-gray-500 leading-relaxed space-y-2 pb-1 w-full min-w-0">
              <p>
                표시되는 ±숫자는 <strong className="text-gray-300">확신도 스케일</strong>입니다. 코스피가 몇 % 오르거나
                내릴지 맞히는 항목이 <strong className="text-gray-300">아닙니다.</strong>
              </p>
              <p>
                해당 방향으로 마갭될 것에 대한{" "}
                <strong className="text-gray-400">확신의 강약</strong>을 나타냅니다. 중앙에 가까울수록 신중함, 양쪽 끝에 가까울수록 해당
                방향에 대한 <strong className="text-gray-400">강한 확신</strong>을 의미합니다.
              </p>
              <p>
                <strong className="text-gray-400">배팅 토큰</strong>은 확신도와 보유량에 따라 자동 산출됩니다. 적중 시{" "}
                <strong className="text-gray-300">배팅한 만큼 토큰을 얻고</strong>, 미적중 시 배팅한 만큼 잃습니다.
              </p>
            </div>
          </details>
        </div>
      )}

      {/* 방향 + 확신도 수치 */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500 font-bold mb-0.5">예측 방향</p>
          <span className={`text-2xl font-black ${dirColor}`}>{dirLabel}</span>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 font-bold mb-0.5">확신도 (등락률 아님)</p>
          <span className={`text-3xl font-black tabular-nums ${dirColor}`}>
            {isUp ? "+" : ""}
            {value}
          </span>
        </div>
      </div>

      <p className="text-center text-lg sm:text-xl font-black text-amber-100 leading-snug">
        얼마나 확신하나요?
      </p>

      {/* 드래그 게이지 */}
      <div
        className={`select-none rounded-xl pt-1 pb-3 -my-1 ${disabled ? "" : "cursor-grab active:cursor-grabbing"}`}
        style={{ touchAction: "none" }}
      >
        <div className="relative h-4 mb-0.5 px-0.5" aria-hidden>
          {GAUGE_TICKS.map(({ v, color }) => (
            <span
              key={v}
              className={`absolute bottom-0 text-[10px] sm:text-xs font-bold tabular-nums leading-none ${color}`}
              style={{
                left: gaugeTickLeft(v),
                transform: gaugeTickTransform(v),
              }}
            >
              {formatGaugeTick(v)}
            </span>
          ))}
        </div>
        <div
          ref={trackRef}
          role="slider"
          aria-valuemin={-100}
          aria-valuemax={100}
          aria-valuenow={value}
          aria-disabled={disabled}
          aria-label="익 거래일 코스피 상승·하락 방향과 확신 정도 선택, 좌측 하락 우측 상승"
          aria-describedby={tipsInteractive ? helpId : undefined}
          className={`relative h-9 w-full rounded-full bg-[#1A1A1A] overflow-hidden border border-[#2A2A2A] ${disabled ? "opacity-50 pointer-events-none" : ""}`}
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
            className={`absolute top-1/2 z-20 -translate-y-1/2 w-6 h-6 rounded-full border-2 shadow-lg pointer-events-none ${isUp ? "bg-red-400 border-red-300" : "bg-blue-400 border-blue-300"}`}
            style={{
              left: `calc(${50 + value / 2}% - 12px)`,
              transition: barTransition,
            }}
          />
        </div>
        {!disabled && (
          <p className="text-center text-sm text-gray-500 mt-2">
            막대를 드래그해 방향·확신도를 정하면 배팅 토큰이 함께 바뀝니다.
          </p>
        )}
      </div>

      <div className="flex justify-between text-sm font-bold px-1 -mt-1">
        <span className="text-blue-400">하락</span>
        <span className="text-red-400">상승</span>
      </div>

      {/* 배팅 정보 */}
      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-3 space-y-1.5">
        <div className="flex justify-between text-base">
          <span className="text-gray-500">보유 토큰</span>
          <span className="text-white font-bold tabular-nums">💰 {tokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-base">
          <span className="text-gray-500">배팅 토큰</span>
          <span className={`font-black tabular-nums ${dirColor}`}>{bet.toLocaleString()}</span>
        </div>
        <div className="h-px bg-[#222]" />
        <div className="flex justify-between gap-2 text-base items-start flex-wrap">
          <span className="text-gray-500 shrink-0">적중 시 보유</span>
          <span className="text-green-400 font-bold text-right leading-snug tabular-nums">
            약 {hitBalance.toLocaleString()} 토큰
          </span>
        </div>
        <div className="flex justify-between text-base">
          <span className="text-gray-500">실패 시</span>
          <span className="text-red-400 font-bold tabular-nums">약 {(tokens - bet).toLocaleString()} 토큰</span>
        </div>
      </div>

      {tipsEnabled ? gaugeDisclaimer : null}
    </div>
  );
}
