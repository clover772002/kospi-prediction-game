"use client";

import type { ParticipationRewardsStatus } from "@/lib/api";

type Props = {
  status: ParticipationRewardsStatus | null | undefined;
  compact?: boolean;
};

export default function WeeklyParticipationCard({ status, compact }: Props) {
  if (!status) return null;

  const days = status.days_this_week ?? 0;
  const max = status.max_days ?? 5;
  const projected = status.projected_weekly_bonus ?? 0;
  const schedule = status.grant_schedule_label ?? "일요일 21:00";
  const showSignup =
    !status.signup_bonus_received &&
    (status.signup_bonus_amount ?? 0) > 0;

  if (compact) {
    return (
      <p className="text-xs text-amber-200/90 text-center px-2">
        이번 주 설문 <span className="font-bold tabular-nums">{days}/{max}</span>일 ·{" "}
        <span className="font-bold tabular-nums">{schedule}</span>{" "}
        <span className="text-amber-300">+{projected}</span> 토큰 예정
      </p>
    );
  }

  return (
    <div className="bg-[#1A1A1A] border border-amber-500/25 rounded-xl px-4 py-3 space-y-2">
      <p className="text-sm font-bold text-amber-200/95">주간 참여 보상</p>
      <p className="text-sm text-white/90 leading-relaxed">
        이번 주(월~일) 거래일 설문{" "}
        <span className="font-black text-amber-300 tabular-nums">
          {days}/{max}
        </span>
        일 참여 · <span className="font-bold text-amber-300 tabular-nums">{schedule}</span>에{" "}
        <span className="font-black text-yellow-400 tabular-nums">+{projected}</span> 토큰 지급 예정
      </p>
      {status.next_tier_days != null && status.next_tier_bonus != null && days < max ? (
        <p className="text-xs text-white/65">
          하루 더 참여하면 예상 +{status.next_tier_bonus} 토큰 (→ {status.next_tier_days}일 기준)
        </p>
      ) : days >= max ? (
        <p className="text-xs text-emerald-400/90">이번 주 최대 참여 구간입니다.</p>
      ) : null}
      {showSignup ? (
        <p className="text-xs text-sky-300/90 border-t border-[#2A2A2A] pt-2">
          신규 가입 시 1회 +{status.signup_bonus_amount} 토큰 (가입 직후 자동 지급)
        </p>
      ) : null}
    </div>
  );
}
