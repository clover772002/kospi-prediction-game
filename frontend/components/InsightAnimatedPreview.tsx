"use client";

import type { ReactNode } from "react";
import type { InsightProductSlug } from "@/lib/insight_card_meta";
import { INSIGHT_CARD_META } from "@/lib/insight_card_meta";
import { useInsightDashboardCompact } from "@/contexts/InsightDashboardCompactContext";

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

export default function InsightAnimatedPreview({
  slug,
  visual = "default",
}: {
  slug: InsightProductSlug;
  /** 대시보드 카드 우측: 작은 compact 미리보기 무시하고 크게 표시 */
  visual?: "default" | "dashboardHero";
}) {
  const caption = INSIGHT_CARD_META[slug].instantExample;
  const theme = THEMES[slug];
  const dashCompact = useInsightDashboardCompact();
  const pinchTiny = dashCompact && visual === "default";
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
          <SvgTitle>고수층 7일 적중률</SvgTitle>
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
    case "time_slice_accuracy":
      svgInner = (
        <>
          <SvgBackdrop theme={theme} />
          <SvgTitle>최고 고수 응답 시간</SvgTitle>
          <Bars heights={[0.28, 0.42, 0.72, 0.5, 0.36]} fillForIndex={(i) => (i % 2 === 0 ? theme.primary : theme.secondary)} />
        </>
      );
      break;
    case "expert_vote_time_profile":
    case "novice_vote_time_profile":
      svgInner = (
        <>
          <SvgBackdrop theme={theme} />
          <SvgTitle>{slug === "expert_vote_time_profile" ? "정답층 투표시간대" : "오답층 투표시간대"}</SvgTitle>
          <Bars heights={[0.22, 0.38, 0.68, 0.52, 0.3]} fillForIndex={() => theme.primary} />
        </>
      );
      break;
    case "expert_leader_pick":
    case "novice_leader_pick":
      svgInner = (
        <>
          <SvgBackdrop theme={theme} />
          <SvgTitle>{slug === "expert_leader_pick" ? "고수 픽 + 확신도" : "하수 픽 + 확신도"}</SvgTitle>
          <Bars heights={[0.78]} fillForIndex={() => theme.primary} />
        </>
      );
      break;
    case "crowd_conviction_spread":
      svgInner = (
        <>
          <SvgBackdrop theme={theme} />
          <DualBarLegend labels={["상승 택함", "하락 택함"]} />
          <Bars heights={[0.58, 0.46]} fillForIndex={(i) => (i === 0 ? theme.primary : theme.secondary)} />
        </>
      );
      break;
  }

  const aspectRatio = `${VB_W} / ${VB_H}`;

  const detailsCls =
    visual === "dashboardHero"
      ? "group mt-0 border-t border-white/[0.06] pt-0.5 pb-0.5 px-1 shrink-0"
      : "group mt-1 border-t border-white/[0.05] pt-1.5";
  const summaryCls =
    visual === "dashboardHero"
      ? "cursor-pointer list-none text-[7px] font-bold leading-tight text-gray-500 hover:text-gray-400 [&::-webkit-details-marker]:hidden"
      : "cursor-pointer list-none text-[10px] font-bold text-gray-600 hover:text-gray-400 [&::-webkit-details-marker]:hidden";
  const captionCls =
    visual === "dashboardHero"
      ? "mt-0.5 text-[7px] leading-snug text-gray-600 pr-0.5"
      : "mt-2 text-[10px] leading-relaxed text-gray-600 pr-1";

  if (visual === "dashboardHero") {
    /** meet + 안쪽 여백: slice처럼 꽉 채우면 둥근 테두리(overflow-hidden)와 맞물려 가장자리가 잘려 보임 */
    return (
      <div className="insight-preview-mount flex h-full min-h-[54px] w-full min-w-0 flex-1 flex-col">
        <div className="relative min-h-[34px] w-full min-w-0 flex-1">
          <svg
            role="img"
            aria-label="이 아이템에서 보게 되는 차트 형태 미리보기"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="xMinYMid meet"
            width="100%"
            height="100%"
            className="absolute left-2 right-3.5 top-1 bottom-1 box-border overflow-visible block"
            xmlns="http://www.w3.org/2000/svg"
          >
            {svgInner}
          </svg>
        </div>
        <details className={detailsCls}>
          <summary className={summaryCls}>
            한 줄 안내<span className="ml-1 font-normal opacity-70 group-open:hidden">열기</span>
            <span className="ml-1 font-normal opacity-70 hidden group-open:inline">접기</span>
          </summary>
          <p className={captionCls}>{caption}</p>
        </details>
      </div>
    );
  }

  if (pinchTiny) {
    return (
      <div className="insight-preview-mount w-full flex items-center justify-center max-h-[40px] overflow-hidden opacity-90">
        <svg
          role="img"
          aria-label="이 아이템에서 보게 되는 차트 형태 미리보기"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ aspectRatio }}
          className="w-full h-9 max-h-9 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
        >
          {svgInner}
        </svg>
      </div>
    );
  }

  return (
    <div className="insight-preview-mount w-full">
      <svg
        role="img"
        aria-label="이 아이템에서 보게 되는 차트 형태 미리보기"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ aspectRatio }}
        className="w-full h-auto min-h-[120px]"
        xmlns="http://www.w3.org/2000/svg"
      >
        {svgInner}
      </svg>
      <details className={detailsCls}>
        <summary className={summaryCls}>
          한 줄 안내<span className="text-gray-600 ml-1 font-normal opacity-65 group-open:hidden">열기</span>
          <span className="text-gray-600 ml-1 font-normal opacity-65 hidden group-open:inline">접기</span>
        </summary>
        <p className={captionCls}>{caption}</p>
      </details>
    </div>
  );
}
