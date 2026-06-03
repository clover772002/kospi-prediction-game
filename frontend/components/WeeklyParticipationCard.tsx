"use client";

import type { ParticipationRewardsStatus } from "@/lib/api";
import { ChipAmount, ChipAmountFraction, formatChipAmountText } from "@/components/ChipAmount";
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
  return (
    <div className="flex flex-col items-center gap-0.5 sm:gap-2 w-full min-w-0">
      <span className="text-[10px] sm:text-sm font-bold text-gray-300 leading-none">{day}회</span>
      <div
        className={`relative aspect-square w-full max-w-[3.5rem] sm:max-w-[4.5rem] mx-auto rounded-lg sm:rounded-xl flex items-center justify-center border-2 transition-colors ${
          earned
            ? "border-red-500/90 bg-red-950/55 shadow-[0_0_10px_rgba(239,68,68,0.25)]"
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
          compact
          muted={!earned}
          className={`sm:hidden ${earned ? "text-red-200" : ""}`}
        />
        <ChipAmount
          amount={chips}
          large
          muted={!earned}
          className={`hidden sm:inline-flex ${earned ? "text-red-200" : ""}`}
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

function StampRow({ days }: { days: number }) {
  return (
    <div
      className="grid w-full grid-cols-5 gap-1 sm:gap-2.5"
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
    <div className={`${surveyUi.card} !px-3 sm:!px-5`}>
      <div className="flex items-center justify-between gap-2">
        <p className={surveyUi.cardTitle}>주간 참여 보상</p>
        <p className={`${surveyUi.cardMeta} shrink-0`}>월~일 거래일</p>
      </div>

      <StampRow days={days} />

      <div className="flex flex-col items-center gap-2.5">
        <p className={surveyUi.label}>도장 합계 (5회 만점 기준)</p>
        <ChipAmountFraction
          current={stampSum}
          max={MAX_STAMP_CHIP_TOTAL}
          xlarge
          className={allStamps ? "text-emerald-300" : ""}
        />
        {allStamps ? (
          <p className={`${surveyUi.body} text-emerald-400/95`}>5회 도장 모두 찍음!</p>
        ) : null}
      </div>

      <div className="flex justify-center">
        <div className={`${surveyUi.highlightBox} text-center w-full max-w-sm`}>
          <p className={`${surveyUi.body} text-amber-200/90 mb-2 leading-snug`}>
            <span className={`${surveyUi.numEmphasis} text-amber-300`}>
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
