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

type Props = {
  status: ParticipationRewardsStatus | null | undefined;
  compact?: boolean;
};

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
  const size = compact ? "w-11 h-11 sm:w-12 sm:h-12" : "w-14 h-14 sm:w-[4.25rem] sm:h-[4.25rem]";
  const labelClass = compact
    ? "text-[9px] font-bold text-gray-500"
    : "text-[10px] sm:text-xs font-bold text-gray-400";

  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0 max-w-[4.5rem]">
      <span className={labelClass}>{day}회</span>
      <div
        className={`relative ${size} rounded-full flex flex-col items-center justify-center border-2 transition-colors ${
          earned
            ? "border-red-500 bg-red-950/50 shadow-[0_0_12px_rgba(239,68,68,0.35)]"
            : "border-[#404040] border-dashed bg-[#222] opacity-90"
        }`}
        aria-label={
          earned
            ? `${day}회 참여 달성, ${chips}칩 구간`
            : `${day}회 미달성, ${chips}칩 구간`
        }
      >
        {earned ? (
          <div
            className="flex flex-col items-center justify-center leading-none -rotate-12 select-none"
            aria-hidden
          >
            <span
              className={`font-black text-red-400 tabular-nums ${
                compact ? "text-[9px]" : "text-[11px] sm:text-xs"
              }`}
            >
              +{chips}
            </span>
            <span className={`font-black text-red-300/95 ${compact ? "text-[8px]" : "text-[9px]"}`}>
              칩
            </span>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center leading-none select-none text-gray-600"
            aria-hidden
          >
            <span className={`font-bold tabular-nums ${compact ? "text-[8px]" : "text-[10px]"}`}>
              +{chips}
            </span>
            <span className={compact ? "text-[7px]" : "text-[8px]"}>칩</span>
          </div>
        )}
        {earned ? (
          <span
            className="pointer-events-none absolute inset-1 rounded-full border border-red-400/40"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}

function StampRow({
  days,
  compact,
}: {
  days: number;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-end justify-between gap-1 sm:gap-2 ${
        compact ? "px-0.5" : "px-1"
      }`}
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
        <p className="text-[10px] text-center text-amber-200/85 tabular-nums">
          <span className="font-bold text-amber-300">
            {days}/{max}
          </span>
          일 · <span className="font-bold">{schedule}</span>{" "}
          <span className="text-amber-300 font-bold">+{projected}칩</span>
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

      <StampRow days={days} />

      <p className="text-center text-xs text-white/80 leading-snug">
        <span className="font-black text-amber-300 tabular-nums">
          {days}/{max}
        </span>
        일 참여 ·{" "}
        <span className="font-bold text-amber-200">{schedule}</span>에{" "}
        <span className="font-black text-yellow-400 tabular-nums">+{projected}칩</span> 지급
      </p>

      {days >= max ? (
        <p className="text-center text-[11px] text-emerald-400/90 font-bold">이번 주 만점 도장!</p>
      ) : status.next_tier_days != null && status.next_tier_bonus != null ? (
        <p className="text-center text-[11px] text-white/55">
          도장 하나 더 찍으면{" "}
          <span className="font-bold text-amber-300 tabular-nums">+{status.next_tier_bonus}칩</span>{" "}
          구간
        </p>
      ) : null}

      {showSignup ? (
        <div className="flex items-center gap-2 border-t border-[#2A2A2A] pt-2.5">
          <div
            className="shrink-0 w-10 h-10 rounded-full border-2 border-sky-500/50 bg-sky-950/40 flex flex-col items-center justify-center -rotate-6"
            aria-hidden
          >
            <span className="text-[9px] font-black text-sky-300">+{status.signup_bonus_amount}</span>
            <span className="text-[8px] font-bold text-sky-400/90">칩</span>
          </div>
          <p className="text-xs text-sky-300/90 leading-snug">
            신규 가입 1회 보너스 · 가입 직후 자동 지급
          </p>
        </div>
      ) : null}
    </div>
  );
}
