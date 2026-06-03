"use client";

import type { ParticipationRewardsStatus } from "@/lib/api";

/** backend/participation_rewards.py WEEKLY_BONUS_BY_DAYS 와 동일 */
const WEEKLY_TIERS: { day: number; chips: number }[] = [
  { day: 1, chips: 10 },
  { day: 2, chips: 20 },
  { day: 3, chips: 35 },
  { day: 4, chips: 50 },
  { day: 5, chips: 70 },
];

const CHIP_ICON = "🪙";

type Props = {
  status: ParticipationRewardsStatus | null | undefined;
  compact?: boolean;
};

/** 🪙 X100 형식 — 한글 「칩」 대신 */
function ChipAmount({
  amount,
  compact,
  large,
  muted,
  className = "",
}: {
  amount: number;
  compact?: boolean;
  large?: boolean;
  muted?: boolean;
  className?: string;
}) {
  const iconSize = large ? "text-2xl" : compact ? "text-sm" : "text-base";
  const textSize = large
    ? "text-lg sm:text-xl"
    : compact
      ? "text-[9px] sm:text-[10px]"
      : "text-[10px] sm:text-xs";

  return (
    <span
      className={`inline-flex items-center gap-0.5 sm:gap-1 leading-none tabular-nums ${className} ${
        muted ? "opacity-55" : ""
      }`}
    >
      <span className={`${iconSize} leading-none`} aria-hidden>
        {CHIP_ICON}
      </span>
      <span
        className={`font-black tracking-tight ${textSize} ${muted ? "text-gray-500" : ""}`}
      >
        X{amount.toLocaleString()}
      </span>
    </span>
  );
}

function ParticipationStamp({
  day,
  chips,
  earned,
  compact,
}: {
  day: number;
  chips: number;
  earned: boolean;
  compact?: boolean;
}) {
  const box = compact ? "w-12 h-12 sm:w-[3.1rem] sm:h-[3.1rem]" : "w-[3.6rem] h-[3.6rem] sm:w-16 sm:h-16";
  const labelClass = compact
    ? "text-[9px] font-bold text-gray-500"
    : "text-[10px] sm:text-xs font-bold text-gray-400";

  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0 max-w-[4.25rem]">
      <span className={labelClass}>{day}회</span>
      <div
        className={`relative ${box} rounded-lg flex items-center justify-center border-2 transition-all ${
          earned
            ? "border-red-500/90 bg-red-950/55 shadow-[0_0_14px_rgba(239,68,68,0.28)] -rotate-6"
            : "border-[#444] border-dashed bg-[#222] rotate-0 opacity-85"
        }`}
        aria-label={
          earned ? `${day}회 참여 달성, ${chips}칩` : `${day}회 미달성, ${chips}칩 구간`
        }
      >
        <div className={`flex flex-col items-center ${earned ? "-rotate-0" : ""}`}>
          <ChipAmount
            amount={chips}
            compact={compact}
            muted={!earned}
            className={earned ? "text-red-200" : ""}
          />
        </div>
        {earned ? (
          <span
            className="pointer-events-none absolute inset-1 rounded-md border border-red-400/35"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}

function StampRow({ days, compact }: { days: number; compact?: boolean }) {
  return (
    <div
      className={`flex items-end justify-between gap-0.5 sm:gap-1.5 ${compact ? "px-0" : "px-0.5"}`}
      role="list"
      aria-label="주간 설문 참여 도장"
    >
      {WEEKLY_TIERS.map(({ day, chips }) => (
        <div key={day} role="listitem" className="flex flex-1 justify-center min-w-0">
          <ParticipationStamp day={day} chips={chips} earned={days >= day} compact={compact} />
        </div>
      ))}
    </div>
  );
}

export default function WeeklyParticipationCard({ status, compact }: Props) {
  if (!status) return null;

  const days = status.days_this_week ?? 0;
  const max = status.max_days ?? 5;
  const projected = status.projected_weekly_bonus ?? 0;
  const schedule = status.grant_schedule_label ?? "일요일 21:00";
  const showSignup =
    !status.signup_bonus_received && (status.signup_bonus_amount ?? 0) > 0;

  if (compact) {
    return (
      <div className="px-1 space-y-1.5">
        <StampRow days={days} compact />
        <p className="text-[10px] text-center text-amber-200/90 flex items-center justify-center gap-1 flex-wrap">
          <span className="font-bold tabular-nums text-amber-300">
            {days}/{max}
          </span>
          <span>일 ·</span>
          <span className="font-bold">{schedule}</span>
          <ChipAmount amount={projected} compact className="text-yellow-400" />
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#1A1A1A] border border-amber-500/25 rounded-xl px-3 sm:px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-amber-200/95">주간 참여 보상</p>
        <p className="text-[10px] text-gray-500 shrink-0">월~일 거래일</p>
      </div>

      <div className="flex justify-center">
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-center">
          <p className="text-[10px] text-amber-200/75 mb-0.5">이번 주 지급 예정</p>
          <ChipAmount amount={projected} large className="text-yellow-400" />
        </div>
      </div>

      <StampRow days={days} />

      <p className="text-center text-xs text-white/80 leading-snug flex items-center justify-center gap-1 flex-wrap">
        <span className="font-black text-amber-300 tabular-nums">
          {days}/{max}
        </span>
        <span>일 참여 ·</span>
        <span className="font-bold text-amber-200">{schedule}</span>
        <span>지급</span>
      </p>

      {days >= max ? (
        <p className="text-center text-[11px] text-emerald-400/90 font-bold">이번 주 만점 도장!</p>
      ) : status.next_tier_days != null && status.next_tier_bonus != null ? (
        <p className="text-center text-[11px] text-white/55 flex items-center justify-center gap-1 flex-wrap">
          <span>도장 하나 더 →</span>
          <ChipAmount amount={status.next_tier_bonus} compact className="text-amber-300" />
          <span>구간</span>
        </p>
      ) : null}

      {showSignup ? (
        <div className="flex items-center gap-3 border-t border-[#2A2A2A] pt-2.5">
          <div
            className="shrink-0 w-14 h-14 rounded-lg border-2 border-sky-500/55 bg-sky-950/45 flex items-center justify-center -rotate-6 shadow-[0_0_10px_rgba(56,189,248,0.2)]"
            aria-hidden
          >
            <ChipAmount
              amount={status.signup_bonus_amount ?? 0}
              className="text-sky-200 [&_span:last-child]:text-xs"
            />
          </div>
          <p className="text-xs text-sky-300/90 leading-snug">
            신규 가입 1회 보너스 · 가입 직후 자동 지급
          </p>
        </div>
      ) : null}
    </div>
  );
}
