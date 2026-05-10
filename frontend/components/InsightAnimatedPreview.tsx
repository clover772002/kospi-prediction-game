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

/** 넓은 카드폭 미리보기용 캔버스 (viewBox 사용자 단위) */
const VB_W = 560;
const VB_H = 100;
const BASE_Y = 78;
const MAX_H = 52;

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
  const gap = 6;
  const barSlot = (VB_W - 40 - (n - 1) * gap) / n;
  const innerW = Math.max(5, barSlot - 5);

  return (
    <>
      {heights.map((fr, i) => {
        const h = Math.max(8, fr * MAX_H);
        const cx = 20 + barSlot / 2 + i * (barSlot + gap);
        return (
          <g key={i} transform={`translate(${cx} ${BASE_Y})`}>
            <g className="ip-bar-rise-group" style={{ animationDelay: `${i * 70}ms` }}>
              <rect
                x={-innerW / 2}
                y={-h}
                width={innerW}
                height={h}
                rx={4}
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

function buildSparkLine(): { dLine: string; approxLen: number } {
  const ys = [68, 58, 64, 48, 56, 52, 62];
  const xs = ys.map((_, i) => 36 + (i * (VB_W - 72)) / (ys.length - 1));
  const dLine = ys.map((y, i) => `${i === 0 ? "M" : "L"} ${xs[i]} ${y}`).join(" ");
  return { dLine, approxLen: 420 };
}

function SvgBackdrop({ theme }: { theme: Theme }) {
  return (
    <>
      <rect x="14" y="14" width={VB_W - 28} height="74" rx="14" fill={theme.soft} stroke={theme.grid} strokeWidth="1.2" />
      <line x1="22" y1={BASE_Y} x2={VB_W - 22} y2={BASE_Y} stroke={theme.grid} strokeWidth="1.8" strokeLinecap="round" />
    </>
  );
}

function DualBarLegend({ labels }: { labels: [string, string] }) {
  const mid = Math.floor(VB_W / 2) + 8;
  return (
    <g fontSize="11" fill="rgba(180,190,205,0.78)" fontWeight="700">
      <text x="26" y="22">
        {labels[0]}
      </text>
      <text x={mid} y="22">
        {labels[1]}
      </text>
    </g>
  );
}

function SvgTitle({ children }: { children: string }) {
  return (
    <text x="26" y="22" fill="rgba(180,190,205,0.78)" fontSize="11" fontWeight="700">
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
        <circle r={r} fill={fill} stroke={stroke} strokeWidth="2" />
      </g>
    );
  }
  const values = `${cx1},${cy}; ${cx2},${cy}; ${cx1},${cy}`;
  return (
    <g>
      <animateTransform attributeName="transform" type="translate" dur="2.9s" repeatCount="indefinite" values={values} keyTimes="0;0.5;1" />
      <circle cx={0} cy={0} r={r} fill={fill} stroke={stroke} strokeWidth="2" />
    </g>
  );
}

export default function InsightAnimatedPreview({ slug }: { slug: InsightProductSlug }) {
  const caption = INSIGHT_CARD_META[slug].instantExample;
  const theme = THEMES[slug];
  const { dLine, approxLen } = buildSparkLine();
  const reduceMotion = usePrefersReducedMotion();

  const gxTrack = Math.round(VB_W * 0.16);
  const gwTrack = Math.round(VB_W * 0.68);
  const gxKnobLeft = gxTrack + 48;
  const gxKnobRight = gxTrack + gwTrack - 48;
  const gyTrack = 50;
  const gyLine = gyTrack + 11;

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
            strokeWidth={3.4}
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
          <rect x={gxTrack} y={gyTrack} width={gwTrack} height="22" rx="9" fill="rgba(0,0,0,0.38)" stroke={theme.grid} />
          <rect
            x={gxTrack + Math.round(gwTrack * 0.22)}
            y={gyTrack + 5}
            width={Math.round(gwTrack * 0.38)}
            height="12"
            rx="5"
            fill={theme.soft}
          />
          <line x1={gxTrack} y1={gyLine} x2={gxTrack + gwTrack} y2={gyLine} stroke={theme.secondary} strokeWidth="1.4" opacity={0.5} strokeLinecap="round" />
          <GaugeKnob cx1={gxKnobLeft} cx2={gxKnobRight} cy={gyLine} r={11} fill={theme.primary} stroke="rgba(255,255,255,0.88)" reduceMotion={reduceMotion} />
        </>
      );
      break;
  }

  return (
    <div className="insight-preview-mount w-full">
      <svg
        role="img"
        aria-label="이 인사이트에서 보게 되는 차트 형태 미리보기"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto min-h-[88px] max-h-[160px]"
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
