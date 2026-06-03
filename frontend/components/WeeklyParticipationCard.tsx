"use client";

import type { ParticipationRewardsStatus } from "@/lib/api";
import { ChipAmount, ChipAmountFraction, formatChipAmountText } from "@/components/ChipAmount";

/** backend/participation_rewards.py WEEKLY_BONUS_BY_DAYS 와 동일 */
const WEEKLY_TIERS: { day: number; chips: number }[] = [
  { day: 1, chips: 10 },
  { day: 2, chips: 20 },
  { day: 3, chips: 35 },
  { day: 4, chips: 50 },
  { day: 5, chips: 70 },
];

const MAX_STAMP_CHIP_TOTAL = WEEKLY_TIERS.reduce((s, t) => s + t.chips, 0);

function stampChipSumForDays(days: number): number {
  return WEEKLY_TIERS.filter((t) => days >= t.day).reduce((s, t) => s + t.chips, 0);
}

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
  const box = compact
    ? "w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem]"
    : "w-[4.75rem] h-[4.75rem] sm:w-24 sm:h-24";
  const labelClass = compact
    ? "text-xs sm:text-sm font-bold text-gray-500"
    : "text-sm sm:text-base font-bold text-gray-300";

  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-0 max-w-[5.5rem] sm:max-w-[6rem]">
      <span className={labelClass}>{day}회</span>
      <div
        className={`relative ${box} rounded-xl flex items-center justify-center border-2 transition-colors ${
          earned
            ? "border-red-500/90 bg-red-950/55 shadow-[0_0_14px_rgba(239,68,68,0.28)]"
            : "border-[#444] border-dashed bg-[#222] opacity-85"
        }`}
        aria-label={
          earned
            ? `${day}회 참여 달성, ${formatChipAmountText(chips)}`
            : `${day}회 미달성, ${formatChipAmountText(chips)} 구간`
        }
      >
        <ChipAmount
          amount={chips}
          xlarge={!compact}
          large={compact}
          muted={!earned}
          className={earned ? "text-red-200" : ""}
        />
        {earned ? (
          <span
            className="pointer-events-none absolute inset-1 rounded-lg border border-red-400/35"
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
      className={`flex items-end justify-between gap-1.5 sm:gap-2 ${compact ? "px-0" : "px-0.5"}`}
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
  const stampSum = stampChipSumForDays(days);
  const allStamps = days >= max;

  if (compact) {
    return (
      <div className="px-1 space-y-2.5">
        <StampRow days={days} compact />
        <p className="text-sm sm:text-base text-center text-amber-200/90 flex flex-col items-center gap-1.5">
          <ChipAmountFraction current={stampSum} max={MAX_STAMP_CHIP_TOTAL} large />
          <span className="flex items-center justify-center gap-2 flex-wrap text-base font-bold">
            <span className="tabular-nums text-amber-300 text-lg">
              {days}/{max}
            </span>
            <span>일 ·</span>
            <span>{schedule}</span>
            <ChipAmount amount={projected} large className="text-yellow-400" />
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#1A1A1A] border border-amber-500/25 rounded-xl px-4 sm:px-5 py-5 space-y-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg sm:text-xl font-black text-amber-200/95">주간 참여 보상</p>
        <p className="text-sm sm:text-base text-gray-500 shrink-0">월~일 거래일</p>
      </div>

      <StampRow days={days} />

      <div className="flex flex-col items-center gap-2.5">
        <p className="text-sm sm:text-base text-gray-400">도장 합계 (5회 만점 기준)</p>
        <ChipAmountFraction
          current={stampSum}
          max={MAX_STAMP_CHIP_TOTAL}
          xlarge
          className={allStamps ? "text-emerald-300" : ""}
        />
        {allStamps ? (
          <p className="text-base sm:text-lg font-bold text-emerald-400/95">5회 도장 모두 찍음!</p>
        ) : null}
      </div>

      <div className="flex justify-center">
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-4 sm:py-5 text-center w-full max-w-sm">
          <p className="text-base sm:text-lg text-amber-200/90 mb-2 leading-snug">
            <span className="font-black text-amber-300 tabular-nums text-xl sm:text-2xl">
              {days}/{max}
            </span>
            <span className="font-bold"> 일 참여 · </span>
            <span className="font-bold">{schedule}</span>
            <span className="font-bold"> 실제 지급</span>
          </p>
          <ChipAmount amount={projected} xlarge className="text-yellow-400 justify-center" />
        </div>
      </div>
    </div>
  );
}
