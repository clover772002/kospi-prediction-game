"use client";

import type { ReactNode } from "react";
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

const VB_W = 280;
const BASE_Y = 46;
const MAX_H = 38;

function Bars({ heights, fillForIndex }: { heights: number[]; fillForIndex: (i: number) => string }) {
  const n = heights.length;
  const gap = 5;
  const barSlot = (VB_W - 32 - (n - 1) * gap) / n;
  const innerW = Math.max(4, barSlot - 4);

  return (
    <>
      {heights.map((fr, i) => {
        const h = Math.max(6, fr * MAX_H);
        const cx = 16 + barSlot / 2 + i * (barSlot + gap);
        return (
          <g key={i} transform={`translate(${cx} ${BASE_Y})`}>
            <g
              className="ip-bar-rise-group"
              style={{ animationDelay: `${i * 72}ms` }}
            >
              <rect
                x={-innerW / 2}
                y={-h}
                width={innerW}
                height={h}
                rx={3}
                fill={fillForIndex(i)}
                className="ip-bar-shape"
                style={{ animationDelay: `${420 + i * 55}ms` }}
              />
            </g>
          </g>
        );
      })}
    </>
  );
}

function buildSparkLine(): { dLine: string; approxLen: number } {
  const ys = [40, 32, 36, 24, 30, 28, 34];
  const xs = ys.map((_, i) => 22 + (i * (VB_W - 44)) / (ys.length - 1));
  const dLine = ys.map((y, i) => `${i === 0 ? "M" : "L"} ${xs[i]} ${y}`).join(" ");
  return { dLine, approxLen: 260 };
}

function SvgBackdrop({ theme }: { theme: Theme }) {
  return (
    <>
      <rect x="8" y="8" width={VB_W - 16} height="48" rx="10" fill={theme.soft} stroke={theme.grid} strokeWidth="1" />
      <line x1="14" y1={BASE_Y} x2={VB_W - 14} y2={BASE_Y} stroke={theme.grid} strokeWidth="1.5" strokeLinecap="round" />
    </>
  );
}

function DualBarLegend({ labels }: { labels: [string, string] }) {
  return (
    <g fontSize="9" fill="rgba(180,190,205,0.75)" fontWeight="700">
      <text x="18" y="14">
        {labels[0]}
      </text>
      <text x="156" y="14">
        {labels[1]}
      </text>
    </g>
  );
}

export default function InsightAnimatedPreview({ slug }: { slug: InsightProductSlug }) {
  const caption = INSIGHT_CARD_META[slug].instantExample;
  const theme = THEMES[slug];
  const { dLine, approxLen } = buildSparkLine();

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
          <text x="18" y="14" fill="rgba(180,190,205,0.72)" fontSize="9" fontWeight="700">
            최근 7거래일 흐름
          </text>
          <path
            d={dLine}
            fill="none"
            stroke={theme.primary}
            strokeWidth={2.4}
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
          <text x="18" y="14" fill="rgba(180,190,205,0.72)" fontSize="9" fontWeight="700">
            시간 버킷 비중
          </text>
          <Bars
            heights={[0.28, 0.42, 0.72, 0.5, 0.36]}
            fillForIndex={(i) => (i % 2 === 0 ? theme.primary : theme.secondary)}
          />
        </>
      );
      break;
    case "expert_vote_time_profile":
    case "novice_vote_time_profile":
      svgInner = (
        <>
          <SvgBackdrop theme={theme} />
          <text x="18" y="14" fill="rgba(180,190,205,0.72)" fontSize="9" fontWeight="700">
            제출 시각대 분포
          </text>
          <Bars heights={[0.22, 0.38, 0.68, 0.52, 0.3]} fillForIndex={() => theme.primary} />
        </>
      );
      break;
    case "crowd_conviction_spread":
      svgInner = (
        <>
          <SvgBackdrop theme={theme} />
          <text x="18" y="14" fill="rgba(180,190,205,0.72)" fontSize="9" fontWeight="700">
            확신 분포 요약
          </text>
          <Bars heights={[0.26, 0.46, 0.78, 0.74, 0.48, 0.38, 0.24]} fillForIndex={() => theme.primary} />
        </>
      );
      break;
    case "my_gauge_vs_crowd":
      svgInner = (
        <>
          <SvgBackdrop theme={theme} />
          <text x="18" y="14" fill="rgba(180,190,205,0.72)" fontSize="9" fontWeight="700">
            같은 편 속 내 위치
          </text>
          <rect x="56" y="28" width="168" height="18" rx="6" fill="rgba(0,0,0,0.32)" stroke={theme.grid} />
          <rect x="108" y="31" width="80" height="12" rx="4" fill={theme.soft} />
          <line x1="56" y1="37" x2="224" y2="37" stroke={theme.secondary} strokeWidth="1.2" opacity={0.45} strokeLinecap="round" />
          <g className="ip-gauge-knob">
            <circle cx={0} cy={0} r="7.5" fill={theme.primary} stroke="rgba(255,255,255,0.85)" strokeWidth="2" />
          </g>
        </>
      );
      break;
  }

  return (
    <div className="insight-preview-mount mt-2 max-w-xl">
      <svg
        role="img"
        aria-label="이 인사이트에서 보게 되는 차트 형태 미리보기"
        viewBox={`0 0 ${VB_W} 56`}
        className="w-full h-auto max-h-[72px]"
        xmlns="http://www.w3.org/2000/svg"
      >
        {svgInner}
      </svg>
      <p className="mt-1.5 text-[10px] leading-relaxed text-gray-600">{caption}</p>
    </div>
  );
}
