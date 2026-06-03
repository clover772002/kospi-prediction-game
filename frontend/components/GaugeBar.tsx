"use client";

import { useCallback, useId, useRef, useState } from "react";
import { ChipAmount } from "@/components/ChipAmount";
import { surveyUi } from "@/lib/survey-ui-tokens";

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

const GAUGE_TICKS: { v: number; color: string }[] = [
  { v: -100, color: "text-blue-400/90" },
  { v: -50, color: "text-gray-500" },
  { v: -10, color: "text-gray-500" },
  { v: 0, color: "text-gray-500" },
  { v: 10, color: "text-gray-500" },
  { v: 50, color: "text-gray-500" },
  { v: 100, color: "text-red-400/90" },
];

function formatGaugeTick(v: number): string {
  if (v === 0) return "0";
  return v > 0 ? `+${v}` : `${v}`;
}

/** 썸이 트랙 끝에서 잘리지 않도록 좌우 여백(반지름) */
const THUMB_SIZE_PX = 28;
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

  const gaugeDisclaimer = (
    <p className={`${surveyUi.hint} leading-snug pt-3 border-t border-[#2A2A2A]`}>
      아래 표시는 <span className="text-gray-400">등락률 예측</span>이 아니라, 제출하신 예측의{" "}
      <span className="text-gray-400">방향·확신도</span>입니다.
    </p>
  );

  return (
    <div className={`w-full max-w-full min-w-0 box-border ${surveyUi.card}`}>
      {tipsInteractive && (
        <div className="space-y-2 pb-2 border-b border-[#2A2A2A] w-full min-w-0">
          <p id={helpId} className={`${surveyUi.bodyMuted} text-gray-300`}>
            막대 <strong className="text-blue-400">왼쪽</strong>=하락·<strong className="text-red-400">오른쪽</strong>
            =상승, 멀수록 그 방향 확신이 큽니다.
          </p>
          <details className="group rounded-xl bg-[#111]/90 border border-[#2a2a2a] px-4 py-3">
            <summary className={`${surveyUi.body} text-cyan-400 cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center gap-1`}>
              <span>확신도·칩 자세히 보기</span>
              <span className="text-gray-600 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className={`mt-2 ${surveyUi.hint} leading-relaxed space-y-2 pb-1 w-full min-w-0`}>
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
                <strong className="text-gray-400">배팅 칩</strong>은 확신도와 보유량에 따라 자동 산출됩니다. 적중 시{" "}
                <strong className="text-gray-300">배팅한 만큼 칩을 얻고</strong>, 미적중 시 배팅한 만큼 잃습니다.
              </p>
            </div>
          </details>
        </div>
      )}

      {/* 방향 + 확신도 수치 */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className={`${surveyUi.label} mb-1`}>예측 방향</p>
          <span className={`${surveyUi.cardTitle} ${dirColor}`}>{dirLabel}</span>
        </div>
        <div className="text-right">
          <p className={`${surveyUi.label} mb-1`}>확신도 (등락률 아님)</p>
          <span className={`${surveyUi.numEmphasis} leading-none ${dirColor}`}>
            {isUp ? "+" : ""}
            {value}
          </span>
        </div>
      </div>

      <p className={`text-center ${surveyUi.cardTitle} text-amber-100 leading-snug`}>얼마나 확신하나요?</p>

      {/* 드래그 게이지 — 썸은 트랙 밖(패딩)에 두어 ±100에서 잘리지 않음 */}
      <div
        ref={trackRef}
        role="slider"
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-disabled={disabled}
        aria-label="익 거래일 코스피 상승·하락 방향과 확신 정도 선택, 좌측 하락 우측 상승"
        aria-describedby={tipsInteractive ? helpId : undefined}
        className={`select-none relative px-3.5 py-5 -mx-0.5 rounded-2xl ${
          disabled ? "opacity-50 pointer-events-none" : "cursor-grab active:cursor-grabbing"
        }`}
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="relative h-6 sm:h-7 mb-3" aria-hidden>
          {GAUGE_TICKS.map(({ v, color }) => (
            <span
              key={v}
              className={`absolute bottom-0 -translate-x-1/2 ${surveyUi.label} tabular-nums leading-none ${color}`}
              style={{ left: gaugePositionCss(v) }}
            >
              {formatGaugeTick(v)}
            </span>
          ))}
        </div>

        <div className="relative flex items-center h-5">
          <div
            className="relative h-4 w-full rounded-full overflow-hidden border border-[#3a3a3a]/90 bg-[#0a0a0c] shadow-[inset_0_2px_10px_rgba(0,0,0,.65),0_1px_0_rgba(255,255,255,.04)]"
          >
            {isUp ? (
              <div
                className="absolute inset-y-0 left-1/2 rounded-r-full bg-gradient-to-r from-red-950/80 via-red-600 to-red-400/95 shadow-[inset_0_0_12px_rgba(248,113,113,.25)]"
                style={{ width: `${halfSpanPct}%`, transition: barTransition }}
              />
            ) : (
              <div
                className="absolute inset-y-0 right-1/2 rounded-l-full bg-gradient-to-l from-blue-950/80 via-blue-600 to-blue-400/95 shadow-[inset_0_0_12px_rgba(96,165,250,.25)]"
                style={{ width: `${halfSpanPct}%`, transition: barTransition }}
              />
            )}
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/25 to-transparent" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border border-white/20 bg-[#1a1a1a]" />
          </div>

          <div
            className="pointer-events-none absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ left: gaugePositionCss(value), transition: barTransition }}
          >
            <div
              className={`relative flex h-7 w-7 items-center justify-center rounded-full border-[3px] bg-[#1a1a1a] shadow-[0_0_0_4px_rgba(0,0,0,.35),0_4px_14px_rgba(0,0,0,.45)] ${
                isUp
                  ? "border-red-300/90 shadow-red-500/20"
                  : "border-blue-300/90 shadow-blue-500/20"
              } ${dragging ? "scale-110" : ""}`}
            >
              <span
                className={`block h-2.5 w-2.5 rounded-full ${isUp ? "bg-red-400" : "bg-blue-400"} shadow-[0_0_8px_currentColor]`}
              />
            </div>
          </div>
        </div>

        {!disabled && (
          <p className={`text-center ${surveyUi.hint} mt-3`}>
            막대를 드래그해 방향·확신도를 정하면 배팅 칩이 함께 바뀝니다.
          </p>
        )}
      </div>

      <div className={`flex justify-between ${surveyUi.body} px-1 -mt-1`}>
        <span className="text-blue-400">하락</span>
        <span className="text-red-400">상승</span>
      </div>

      {/* 배팅 정보 */}
      <div className={`${surveyUi.highlightBox} space-y-3`}>
        <div className={`flex justify-between ${surveyUi.body} items-center`}>
          <span className={surveyUi.label}>보유</span>
          <ChipAmount amount={tokens} xlarge className="text-white" />
        </div>
        <div className={`flex justify-between ${surveyUi.body} items-center`}>
          <span className={surveyUi.label}>배팅</span>
          <ChipAmount amount={bet} xlarge className={dirColor} />
        </div>
        <div className="h-px bg-amber-500/20" />
        <div className={`flex justify-between gap-2 ${surveyUi.body} items-center flex-wrap`}>
          <span className={`${surveyUi.label} shrink-0`}>적중 시</span>
          <ChipAmount amount={hitBalance} xlarge className="text-green-400" />
        </div>
        <div className={`flex justify-between ${surveyUi.body} items-center`}>
          <span className={surveyUi.label}>실패 시</span>
          <ChipAmount amount={Math.max(0, tokens - bet)} xlarge className="text-red-400" />
        </div>
      </div>

      {tipsEnabled ? gaugeDisclaimer : null}
    </div>
  );
}
