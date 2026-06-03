"use client";

import type { ParticipationRewardsStatus } from "@/lib/api";
import { CHIP_ICON, ChipAmount, ChipAmountFraction, formatChipAmountText } from "@/components/ChipAmount";
import { surveyUi } from "@/lib/survey-ui-tokens";

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
      <span className="text-[7px] sm:text-xs font-bold text-gray-300 leading-none">{day}회</span>
      <div
        className={`relative aspect-square w-full min-w-0 max-w-[2.4rem] mx-auto sm:max-w-none rounded sm:rounded-lg flex items-center justify-center border transition-colors ${
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
          <span className={`text-[8px] sm:text-sm font-black ${chipTone}`}>{chips}</span>
          <span className="text-[9px] sm:text-base leading-none" aria-hidden>
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
      className="grid w-full max-w-full min-w-0 grid-cols-5 gap-0 sm:gap-2"
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
  const stampSum = stampChipSumForDays(days);
  const allStamps = days >= max;

  return (
    <div
      className={`${surveyUi.card} !px-2 !py-3 sm:!px-5 sm:!py-5 space-y-2 sm:space-y-5 max-w-full min-w-0 overflow-x-hidden`}
    >
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <p className="text-base sm:text-lg font-black text-amber-200/95 shrink min-w-0">주간 참여 보상</p>
        <p className="text-[10px] sm:text-base text-gray-500 shrink-0">월~일</p>
      </div>

      <StampRow days={days} />

      <div className="flex flex-col items-center gap-1.5 sm:gap-2.5 min-w-0 max-w-full">
        <p className="text-xs sm:text-base font-bold text-gray-400">도장 합계 (5회 만점)</p>
        <ChipAmountFraction
          current={stampSum}
          max={MAX_STAMP_CHIP_TOTAL}
          large
          className={`sm:hidden ${allStamps ? "text-emerald-300" : ""}`}
        />
        <ChipAmountFraction
          current={stampSum}
          max={MAX_STAMP_CHIP_TOTAL}
          xlarge
          className={`hidden sm:inline-flex ${allStamps ? "text-emerald-300" : ""}`}
        />
        {allStamps ? (
          <p className={`${surveyUi.body} text-emerald-400/95`}>5회 도장 모두 찍음!</p>
        ) : null}
      </div>

      <div className="flex justify-center">
        <div className={`${surveyUi.highlightBox} !px-2 !py-2.5 sm:!px-4 sm:!py-5 text-center w-full max-w-sm min-w-0`}>
          <p className="text-xs sm:text-lg font-bold text-amber-200/90 mb-1.5 sm:mb-2 leading-snug">
            <span className="text-base sm:text-2xl font-black tabular-nums text-amber-300">
              {days}/{max}
            </span>
            <span className="font-bold"> 일 · </span>
            <span className="font-bold">{schedule}</span>
            <span className="font-bold"> 지급</span>
          </p>
          <ChipAmount amount={projected} large className="text-yellow-400 justify-center sm:hidden" />
          <ChipAmount amount={projected} xlarge className="text-yellow-400 justify-center hidden sm:inline-flex" />
        </div>
      </div>
    </div>
  );
}
