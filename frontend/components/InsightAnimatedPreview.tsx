"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { InsightProductSlug } from "@/lib/insight_card_meta";
import { INSIGHT_CARD_META } from "@/lib/insight_card_meta";

type Theme = {
  primary: string;
  secondary: string;
  grid: string;
  soft: string;
};

const THEMES: Record<InsightProductSlug, Theme> = {
  daily_expert_gap: {
    primary: "rgba(167,139,250,0.92)",
    secondary: "rgba(125,211,252,0.88)",
    grid: "rgba(255,255,255,0.08)",
    soft: "rgba(139,92,246,0.18)",
  },
  rolling_crowd_summary: {
    primary: "rgba(56,189,248,0.9)",
    secondary: "rgba(14,165,233,0.75)",
    grid: "rgba(255,255,255,0.08)",
    soft: "rgba(56,189,248,0.14)",
  },
  group_vs_global_snapshot: {
    primary: "rgba(52,211,153,0.9)",
    secondary: "rgba(16,185,129,0.65)",
    grid: "rgba(255,255,255,0.08)",
    soft: "rgba(52,211,153,0.15)",
  },
  time_slice_accuracy: {
    primary: "rgba(251,191,36,0.92)",
    secondary: "rgba(245,158,11,0.75)",
    grid: "rgba(255,255,255,0.08)",
    soft: "rgba(251,191,36,0.14)",
  },
  expert_vote_time_profile: {
    primary: "rgba(129,140,248,0.95)",
    secondary: "rgba(99,102,241,0.75)",
    grid: "rgba(255,255,255,0.08)",
    soft: "rgba(129,140,248,0.14)",
  },
  novice_vote_time_profile: {
    primary: "rgba(148,163,184,0.95)",
    secondary: "rgba(100,116,139,0.75)",
    grid: "rgba(255,255,255,0.08)",
    soft: "rgba(148,163,184,0.12)",
  },
  expert_leader_pick: {
    primary: "rgba(196,181,253,0.95)",
    secondary: "rgba(167,139,250,0.78)",
    grid: "rgba(255,255,255,0.08)",
    soft: "rgba(196,181,253,0.14)",
  },
  novice_leader_pick: {
    primary: "rgba(165,180,252,0.88)",
    secondary: "rgba(129,140,248,0.72)",
    grid: "rgba(255,255,255,0.08)",
    soft: "rgba(165,180,252,0.10)",
  },
  crowd_conviction_spread: {
    primary: "rgba(251,113,133,0.92)",
    secondary: "rgba(244,114,182,0.7)",
    grid: "rgba(255,255,255,0.08)",
    soft: "rgba(251,113,133,0.12)",
  },
  my_gauge_vs_crowd: {
    primary: "rgba(45,212,191,0.95)",
    secondary: "rgba(20,184,166,0.75)",
    grid: "rgba(255,255,255,0.08)",
    soft: "rgba(45,212,191,0.16)",
  },
};

/** 가로폭 활용 · 세로도 충분히 확보(~2.2:1) — 카드 폭만큼 키우면 높이도 같이 따라감(aspect-ratio) */
const VB_W = 480;
const VB_H = 220;

const TITLE_Y = 22;
const TITLE_FS = 13;
const PANEL_X = 16;
const PANEL_Y = 40;
const PANEL_W = VB_W - 32;
/** 차트 패널(배경) 높이: 베이스라인 포함 */
const PANEL_H = VB_H - PANEL_Y - 18;
/** 막대·스파크가 서는 바닥선 */
const BASELINE_Y = PANEL_Y + PANEL_H - 10;
/** 막대 최대 높이(픽셀, viewBox 단위) */
const BAR_MAX = BASELINE_Y - PANEL_Y - 44;

function usePrefersReducedMotion(): boolean {
  const [v, setV] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setV(mq.matches);
    const on = () => setV(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return v;
}

function Bars({ heights, fillForIndex }: { heights: number[]; fillForIndex: (i: number) => string }) {
  const n = heights.length;
  const gap = 7;
  const barSlot = (VB_W - 36 - (n - 1) * gap) / n;
  const innerW = Math.max(7, Math.min(barSlot - 6, barSlot * 0.82));

  return (
    <>
      {heights.map((fr, i) => {
        const h = Math.max(10, fr * BAR_MAX);
        const cx = 18 + barSlot / 2 + i * (barSlot + gap);
        return (
          <g key={i} transform={`translate(${cx} ${BASELINE_Y})`}>
            <g className="ip-bar-rise-group" style={{ animationDelay: `${i * 70}ms` }}>
              <rect
                x={-innerW / 2}
                y={-h}
                width={innerW}
                height={h}
                rx={5}
                fill={fillForIndex(i)}
                className="ip-bar-shape"
                style={{ animationDelay: `${400 + i * 50}ms` }}
              />
            </g>
          </g>
        );
      })}
    </>
  );
}

/** 스파크: 패널 안에서 세로 진폭을 크게 줌 */
function buildSparkLine(): { dLine: string; approxLen: number } {
  const yLo = BASELINE_Y - 14;
  const yHi = PANEL_Y + 46;
  const samples = [0.85, 0.35, 0.55, 0.08, 0.42, 0.28, 0.62];
  const ys = samples.map((t) => yLo - t * (yLo - yHi));
  const xs = ys.map((_, i) => 28 + (i * (VB_W - 56)) / (ys.length - 1));
  const dLine = ys.map((y, i) => `${i === 0 ? "M" : "L"} ${xs[i]} ${y}`).join(" ");
  const approxLen = 480;
  return { dLine, approxLen };
}

function SvgBackdrop({ theme }: { theme: Theme }) {
  return (
    <>
      <rect
        x={PANEL_X}
        y={PANEL_Y}
        width={PANEL_W}
        height={PANEL_H}
        rx="16"
        fill={theme.soft}
        stroke={theme.grid}
        strokeWidth="1.2"
      />
      <line
        x1={PANEL_X + 10}
        y1={BASELINE_Y}
        x2={VB_W - PANEL_X - 10}
        y2={BASELINE_Y}
        stroke={theme.grid}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  );
}

function DualBarLegend({ labels }: { labels: [string, string] }) {
  const mid = Math.floor(VB_W * 0.52);
  return (
    <g fontSize={TITLE_FS} fill="rgba(190,198,212,0.88)" fontWeight="700">
      <text x="28" y={PANEL_Y + 26}>
        {labels[0]}
      </text>
      <text x={mid} y={PANEL_Y + 26}>
        {labels[1]}
      </text>
    </g>
  );
}

function SvgTitle({ children }: { children: string }) {
  return (
    <text x="28" y={TITLE_Y} fill="rgba(190,198,212,0.88)" fontSize={TITLE_FS} fontWeight="700">
      {children}
    </text>
  );
}

function GaugeKnob({
  cx1,
  cx2,
  cy,
  r,
  fill,
  stroke,
  reduceMotion,
}: {
  cx1: number;
  cx2: number;
  cy: number;
  r: number;
  fill: string;
  stroke: string;
  reduceMotion: boolean;
}) {
  if (reduceMotion) {
    const mid = (cx1 + cx2) / 2;
    return (
      <g transform={`translate(${mid},${cy})`}>
        <circle r={r} fill={fill} stroke={stroke} strokeWidth="2.25" />
      </g>
    );
  }
  const values = `${cx1},${cy}; ${cx2},${cy}; ${cx1},${cy}`;
  return (
    <g>
      <animateTransform
        attributeName="transform"
        type="translate"
        dur="2.9s"
        repeatCount="indefinite"
        values={values}
        keyTimes="0;0.5;1"
      />
      <circle cx={0} cy={0} r={r} fill={fill} stroke={stroke} strokeWidth="2.25" />
    </g>
  );
}

export default function InsightAnimatedPreview({ slug }: { slug: InsightProductSlug }) {
  const caption = INSIGHT_CARD_META[slug].instantExample;
  const theme = THEMES[slug];
  const { dLine, approxLen } = buildSparkLine();
  const reduceMotion = usePrefersReducedMotion();

  const gxTrack = Math.round(VB_W * 0.14);
  const gwTrack = Math.round(VB_W * 0.72);
  const gxKnobLeft = gxTrack + Math.round(gwTrack * 0.12);
  const gxKnobRight = gxTrack + Math.round(gwTrack * 0.88);
  const gyTrack = Math.round(BASELINE_Y - 54);
  const gyLine = gyTrack + 14;

  let svgInner: ReactNode;
  switch (slug) {
    case "daily_expert_gap":
      svgInner = (
        <>
          <SvgBackdrop theme={theme} />
          <DualBarLegend labels={["단순", "가중"]} />
          <Bars heights={[0.62, 0.48]} fillForIndex={(i) => (i === 0 ? theme.secondary : theme.primary)} />
        </>
      );
      break;
    case "rolling_crowd_summary":
      svgInner = (
        <>
          <SvgBackdrop theme={theme} />
          <SvgTitle>최근 7거래일 흐름</SvgTitle>
          <path
            d={dLine}
            fill="none"
            stroke={theme.primary}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ip-spark-line"
            strokeDasharray={approxLen}
            strokeDashoffset={approxLen}
          />
        </>
      );
      break;
    case "group_vs_global_snapshot":
      svgInner = (
        <>
          <SvgBackdrop theme={theme} />
          <DualBarLegend labels={["내 그룹", "전체"]} />
          <Bars heights={[0.55, 0.44]} fillForIndex={(i) => (i === 0 ? theme.primary : theme.secondary)} />
        </>
      );
      break;
    case "time_slice_accuracy":
      svgInner = (
        <>
          <SvgBackdrop theme={theme} />
          <SvgTitle>시간 버킷 비중</SvgTitle>
          <Bars heights={[0.28, 0.42, 0.72, 0.5, 0.36]} fillForIndex={(i) => (i % 2 === 0 ? theme.primary : theme.secondary)} />
        </>
      );
      break;
    case "expert_vote_time_profile":
    case "novice_vote_time_profile":
      svgInner = (
        <>
          <SvgBackdrop theme={theme} />
          <SvgTitle>제출 시각대 분포</SvgTitle>
          <Bars heights={[0.22, 0.38, 0.68, 0.52, 0.3]} fillForIndex={() => theme.primary} />
        </>
      );
      break;
    case "expert_leader_pick":
    case "novice_leader_pick":
      svgInner = (
        <>
          <SvgBackdrop theme={theme} />
          <SvgTitle>무리 규격 1순위 · 방향</SvgTitle>
          <Bars heights={[0.78]} fillForIndex={() => theme.primary} />
        </>
      );
      break;
    case "crowd_conviction_spread":
      svgInner = (
        <>
          <SvgBackdrop theme={theme} />
          <SvgTitle>확신 분포 요약</SvgTitle>
          <Bars heights={[0.26, 0.46, 0.78, 0.74, 0.48, 0.38, 0.24]} fillForIndex={() => theme.primary} />
        </>
      );
      break;
    case "my_gauge_vs_crowd":
      svgInner = (
        <>
          <SvgBackdrop theme={theme} />
          <SvgTitle>같은 편 속 내 위치</SvgTitle>
          <rect x={gxTrack} y={gyTrack} width={gwTrack} height="26" rx="11" fill="rgba(0,0,0,0.42)" stroke={theme.grid} />
          <rect
            x={gxTrack + Math.round(gwTrack * 0.2)}
            y={gyTrack + 6}
            width={Math.round(gwTrack * 0.42)}
            height="14"
            rx="6"
            fill={theme.soft}
          />
          <line
            x1={gxTrack}
            y1={gyLine}
            x2={gxTrack + gwTrack}
            y2={gyLine}
            stroke={theme.secondary}
            strokeWidth="1.75"
            opacity={0.55}
            strokeLinecap="round"
          />
          <GaugeKnob
            cx1={gxKnobLeft}
            cx2={gxKnobRight}
            cy={gyLine}
            r={12.5}
            fill={theme.primary}
            stroke="rgba(255,255,255,0.9)"
            reduceMotion={reduceMotion}
          />
        </>
      );
      break;
  }

  const aspectRatio = `${VB_W} / ${VB_H}`;

  return (
    <div className="insight-preview-mount w-full">
      <svg
        role="img"
        aria-label="이 인사이트에서 보게 되는 차트 형태 미리보기"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ aspectRatio }}
        className="w-full h-auto min-h-[120px]"
        xmlns="http://www.w3.org/2000/svg"
      >
        {svgInner}
      </svg>
      <details className="group mt-1 border-t border-white/[0.05] pt-1.5">
        <summary className="cursor-pointer list-none text-[10px] font-bold text-gray-600 hover:text-gray-400 [&::-webkit-details-marker]:hidden">
          한 줄 안내<span className="text-gray-600 ml-1 font-normal opacity-65 group-open:hidden">열기</span>
          <span className="text-gray-600 ml-1 font-normal opacity-65 hidden group-open:inline">접기</span>
        </summary>
        <p className="mt-2 text-[10px] leading-relaxed text-gray-600 pr-1">{caption}</p>
      </details>
    </div>
  );
}
