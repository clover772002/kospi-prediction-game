"use client";

import { useCallback, useId, useRef, useState } from "react";

interface GaugeBarProps {
  value: number; // -100 ~ +100 (0 제외)
  onChange: (v: number) => void;
  tokens: number; // 현재 보유 토큰
  disabled?: boolean;
  /** false면 안내 숨김 · 생략 시 조작/읽기 전용 각각 맞는 짧은 안내 표시 */
  beginnerTips?: boolean;
  /** 집단배율 추정(당일 오늘의 상승 응답 비율). 없으면 적중 금액은 문구만 표시 */
  kospiYesPct?: number | null;
  /** 서버 적중 계산 시 곱해지는 연승 배수(1 · 1.5 · 2) · 없으면 1로 간주 */
  streakBetMult?: number | null;
}

function calcBet(gauge: number, tokens: number) {
  return Math.max(1, Math.round((Math.abs(gauge) / 100) * tokens));
}

function estimateCrowdMultiplier(gauge: number, yesPct: number | null | undefined): number | null {
  if (yesPct === null || yesPct === undefined) return null;
  const y = Number(yesPct);
  if (!Number.isFinite(y)) return null;
  const crowdUp = Math.max(5, y);
  const crowdDn = Math.max(5, 100 - y);
  return gauge > 0
    ? Math.round((crowdDn / crowdUp) * 1000) / 1000
    : Math.round((crowdUp / crowdDn) * 1000) / 1000;
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
  kospiYesPct,
  streakBetMult,
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
  const crowdMult = estimateCrowdMultiplier(value, kospiYesPct);
  const streakM = streakBetMult != null && Number.isFinite(streakBetMult) && streakBetMult > 0 ? streakBetMult : 1;

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

  let hitPreviewTokens: number | null = null;
  if (crowdMult !== null) {
    hitPreviewTokens = Math.max(1, Math.round(bet * crowdMult * streakM));
  }

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
              </p>
              <p>
                「그 방향으로 장이 마감될 거라고 <strong className="text-gray-400">얼마나 확신하는지</strong>」를 나타내요.
                가운데에 가까울수록 망설임, 양 끝에 가까울수록 그 방향에 <strong className="text-gray-400">강하게 확신</strong>하는
                정도예요.
              </p>
              <p>
                <strong className="text-gray-400">배팅 토큰</strong>은 확신 크기와 보유에 비례해 자동 산출돼요. 적중 시에는{" "}
                <strong className="text-gray-400">배팅 토큰 × 집단배율</strong>을 기준으로 지급이 정해지며, 연승이 있으면 그 위에 추가
                배율이 곱해질 수 있어요.
              </p>
            </div>
          </details>
        </div>
      )}

      {/* 방향 + 게이지 수치 */}
      <div className="flex items-center justify-between">
        <span className={`text-xl font-black ${dirColor}`}>{dirLabel}</span>
        <span className={`text-2xl font-black tabular-nums ${dirColor}`}>
          {isUp ? "+" : ""}
          {value}%
        </span>
      </div>

      {/* 드래그 게이지 */}
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
          <p className="text-center text-[10px] text-gray-500 mt-2">막대를 드래그해 조절하면 배팅 토큰도 같이 바뀝니다.</p>
        )}
      </div>

      {/* -100 / 0 / +100 라벨 */}
      <div className="flex justify-between text-[10px] text-gray-600 px-1">
        <span>-100%</span>
        <span>0</span>
        <span>+100%</span>
      </div>

      {/* 배팅 정보 */}
      <div className="bg-[#111] border border-[#2A2A2A] rounded-xl p-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">보유 토큰</span>
          <span className="text-white font-bold tabular-nums">💰 {tokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">배팅 토큰</span>
          <span className={`font-black tabular-nums ${dirColor}`}>{bet.toLocaleString()}</span>
        </div>
        <div className="h-px bg-[#222]" />
        <div className="flex justify-between gap-2 text-xs items-start flex-wrap">
          <span className="text-gray-500 shrink-0">적중 시</span>
          {crowdMult !== null ? (
            <span className="text-green-400 font-bold text-right leading-snug">
              {bet.toLocaleString()} × {crowdMult.toFixed(2)} (집단배율)
              {streakM > 1 ? ` × ${streakM} (연승)` : ""}
              {" → "}
              약 +{hitPreviewTokens?.toLocaleString()} 토큰
            </span>
          ) : (
            <span className="text-green-400 font-bold text-right leading-snug">배팅 토큰 × 집단배율 (종가 후 확정)</span>
          )}
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">실패 시</span>
          <span className="text-red-400 font-bold">-{bet.toLocaleString()} 토큰</span>
        </div>
      </div>
    </div>
  );
}
