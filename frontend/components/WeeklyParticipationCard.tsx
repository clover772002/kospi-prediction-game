"use client";

import type { ParticipationRewardsStatus } from "@/lib/api";
import { CHIP_ICON, ChipAmount, formatChipAmountText } from "@/components/ChipAmount";
import { surveyUi } from "@/lib/survey-ui-tokens";

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
  /** @deprecated 설문·대시 동일 카드 사용. true여도 동일 레이아웃 */
  compact?: boolean;
};

function ParticipationStamp({
  day,
  chips,
  earned,
}: {
  day: number;
  chips: number;
  earned: boolean;
}) {
  const chipTone = earned ? "text-red-200" : "text-gray-400";

  return (
    <div className="flex flex-col items-center gap-0.5 sm:gap-1.5 w-full min-w-0">
      <span className="text-[9px] sm:text-xs font-bold text-gray-300 leading-none">{day}회</span>
      <div
        className={`relative aspect-square w-full min-w-0 max-w-[3.1rem] mx-auto sm:max-w-none rounded-md sm:rounded-lg flex items-center justify-center border transition-colors ${
          earned
            ? "border-red-500/90 bg-red-950/55 shadow-[0_0_8px_rgba(239,68,68,0.22)]"
            : "border-[#444] border-dashed bg-[#222] opacity-85"
        }`}
        aria-label={
          earned
            ? `${day}회 참여 달성, ${formatChipAmountText(chips)}`
            : `${day}회 미달성, ${formatChipAmountText(chips)} 구간`
        }
      >
        <span
          className={`inline-flex flex-col items-center leading-none tabular-nums ${
            !earned ? "opacity-55" : ""
          }`}
        >
          <span className={`text-[10px] sm:text-sm font-black ${chipTone}`}>{chips}</span>
          <span className="text-xs sm:text-base leading-none" aria-hidden>
            {CHIP_ICON}
          </span>
        </span>
        {earned ? (
          <span
            className="pointer-events-none absolute inset-0.5 rounded-[4px] border border-red-400/30"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}

function StampRow({ days }: { days: number }) {
  return (
    <div
      className="grid w-full max-w-full min-w-0 grid-cols-5 gap-0.5 sm:gap-2"
      role="list"
      aria-label="주간 설문 참여 도장"
    >
      {WEEKLY_TIERS.map(({ day, chips }) => (
        <div key={day} role="listitem" className="min-w-0">
          <ParticipationStamp day={day} chips={chips} earned={days >= day} />
        </div>
      ))}
    </div>
  );
}

export default function WeeklyParticipationCard({ status }: Props) {
  if (!status) return null;

  const days = status.days_this_week ?? 0;
  const max = status.max_days ?? 5;
  const projected = status.projected_weekly_bonus ?? 0;
  const schedule = status.grant_schedule_label ?? "일요일 21:00";

  return (
    <div
      className={`${surveyUi.card} !px-2 !py-3 sm:!px-5 sm:!py-5 space-y-3 sm:space-y-4 max-w-full min-w-0 overflow-x-hidden`}
    >
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <p className="text-base sm:text-lg font-black text-amber-200/95 shrink min-w-0">주간 참여 보상</p>
        <p className="text-[10px] sm:text-base text-gray-500 shrink-0">월~일</p>
      </div>

      <StampRow days={days} />

      <div className="flex justify-center">
        <div
          className={`${surveyUi.highlightBox} !px-3 !py-3 sm:!px-4 sm:!py-4 text-center w-full max-w-sm min-w-0 space-y-2`}
        >
          <p className="text-sm sm:text-lg font-bold text-amber-200/90 leading-snug">
            <span className="font-black tabular-nums text-amber-300">
              {days}/{max}
            </span>
            <span className="font-bold"> 일 참여 · </span>
            <span className="font-bold">{schedule}</span>
            <span className="font-bold"> 실제 지급</span>
          </p>
          <ChipAmount amount={projected} xlarge className="text-yellow-400 justify-center w-full" />
        </div>
      </div>
    </div>
  );
}
