"use client";

import type { ParticipationRewardsStatus } from "@/lib/api";

/** 참여 1일 = 코인 1개(10칩)로 쌓는 시각 — 실제 지급액은 구간 보너스表 */
const CHIP_PER_COIN = 10;
const MAX_COINS = 5;

type Props = {
  status: ParticipationRewardsStatus | null | undefined;
  compact?: boolean;
};

/** 옆에서 본 동전 단면(타원) */
function CoinEdge({
  earned,
  stackIndex,
  compact,
  isTopEarned,
  tone = "gold",
}: {
  earned: boolean;
  stackIndex: number;
  compact?: boolean;
  isTopEarned?: boolean;
  tone?: "gold" | "sky";
}) {
  const w = compact ? "w-[2.35rem]" : "w-[3.25rem]";
  const h = compact ? "h-[0.72rem]" : "h-[0.95rem]";
  const overlap = compact ? "-mt-[0.38rem]" : "-mt-[0.48rem]";
  const earnedClass =
    tone === "sky"
      ? "border-sky-200/90 bg-gradient-to-b from-sky-200 via-sky-400 to-sky-700 shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
      : "border-amber-200/90 bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 shadow-[0_2px_6px_rgba(0,0,0,0.45)]";
  const earnedText = tone === "sky" ? "text-sky-950/75" : "text-amber-950/75";

  return (
    <div
      className={`relative ${w} ${h} ${overlap} first:mt-0 shrink-0 rounded-[50%] border transition-all duration-300 ${
        earned ? earnedClass : "border-[#4a4a4a] bg-gradient-to-b from-[#3a3a3a] to-[#252525] opacity-55"
      }`}
      style={{ zIndex: stackIndex }}
      aria-hidden
    >
      {earned ? (
        <>
          <span
            className={`absolute inset-0 flex items-center justify-center font-black tabular-nums ${earnedText} ${
              compact ? "text-[7px]" : "text-[8px]"
            }`}
          >
            {CHIP_PER_COIN}
          </span>
          <span
            className="pointer-events-none absolute left-[12%] right-[55%] top-[8%] h-[28%] rounded-full bg-white/35"
            aria-hidden
          />
        </>
      ) : (
        <span
          className={`absolute inset-0 flex items-center justify-center font-bold text-gray-600 tabular-nums ${
            compact ? "text-[6px]" : "text-[7px]"
          }`}
        >
          {CHIP_PER_COIN}
        </span>
      )}
      {isTopEarned ? (
        <span
          className="pointer-events-none absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-amber-100/90 shadow-sm"
          aria-hidden
        />
      ) : null}
    </div>
  );
}

function ParticipationCoinStack({
  days,
  max,
  compact,
}: {
  days: number;
  max: number;
  compact?: boolean;
}) {
  const stackH = compact ? "min-h-[3.6rem]" : "min-h-[5.25rem]";

  return (
    <div
      className={`flex flex-col items-center ${stackH}`}
      role="img"
      aria-label={`설문 참여 ${days}일, 코인 ${days}개 쌓임`}
    >
      <div className="flex flex-col-reverse items-center justify-end pb-0.5">
        {Array.from({ length: max }, (_, i) => {
          const level = i + 1;
          const earned = level <= days;
          return (
            <CoinEdge
              key={level}
              earned={earned}
              stackIndex={level}
              compact={compact}
              isTopEarned={earned && level === days && days > 0}
            />
          );
        })}
      </div>
      {/* 받침대 */}
      <div
        className={`${compact ? "w-[2.9rem] h-1" : "w-[3.75rem] h-1.5"} rounded-sm bg-gradient-to-r from-[#333] via-[#444] to-[#333] shadow-inner`}
        aria-hidden
      />
    </div>
  );
}

function DayScale({ days, max, compact }: { days: number; max: number; compact?: boolean }) {
  return (
    <div
      className={`flex justify-center gap-1 sm:gap-1.5 tabular-nums ${
        compact ? "text-[8px]" : "text-[9px]"
      } text-gray-500 font-bold w-full max-w-[11rem] mx-auto`}
    >
      {Array.from({ length: max }, (_, i) => {
        const d = i + 1;
        const hit = d <= days;
        return (
          <span
            key={d}
            className={`flex-1 text-center ${hit ? "text-amber-300" : "text-gray-600"}`}
          >
            {d}일
          </span>
        );
      })}
    </div>
  );
}

export default function WeeklyParticipationCard({ status, compact }: Props) {
  if (!status) return null;

  const days = status.days_this_week ?? 0;
  const max = status.max_days ?? MAX_COINS;
  const projected = status.projected_weekly_bonus ?? 0;
  const schedule = status.grant_schedule_label ?? "일요일 21:00";
  const showSignup =
    !status.signup_bonus_received && (status.signup_bonus_amount ?? 0) > 0;
  const coinCount = Math.min(days, max);
  const signupCoins = showSignup
    ? Math.min(5, Math.max(1, Math.round((status.signup_bonus_amount ?? 0) / CHIP_PER_COIN)))
    : 0;

  if (compact) {
    return (
      <div className="flex items-end justify-center gap-3 px-1">
        <ParticipationCoinStack days={days} max={max} compact />
        <div className="pb-1 text-left min-w-0">
          <p className="text-[10px] font-bold text-amber-200/90">주간 참여</p>
          <p className="text-[10px] text-white/75 tabular-nums">
            코인 <span className="font-black text-amber-300">{coinCount}</span>개 ·{" "}
            <span className="font-black text-yellow-400">+{projected}칩</span>
          </p>
          <p className="text-[9px] text-gray-500">{schedule}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1A1A1A] border border-amber-500/25 rounded-xl px-3 sm:px-4 py-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-amber-200/95">주간 참여 보상</p>
          <p className="text-[10px] text-gray-500 mt-0.5">월~일 거래일 · 코인 1개 = 10칩</p>
        </div>
        <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold text-amber-200/90">
          1코인=10칩
        </span>
      </div>

      <div className="flex items-end justify-center gap-6 sm:gap-10 py-1">
        <div className="flex flex-col items-center gap-1.5">
          <div className="rounded-lg border border-amber-500/25 bg-amber-950/30 px-2.5 py-1 text-center">
            <p className="text-[10px] text-amber-200/80">이번 주 지급 예정</p>
            <p className="text-lg font-black text-yellow-400 tabular-nums leading-tight">
              +{projected}
              <span className="text-xs font-bold text-amber-200/90 ml-0.5">칩</span>
            </p>
          </div>
          <ParticipationCoinStack days={days} max={max} />
          <DayScale days={days} max={max} />
          <p className="text-[10px] text-center text-gray-500">
            참여 <span className="font-bold text-amber-300 tabular-nums">{days}</span>일 → 코인{" "}
            <span className="font-bold text-amber-300 tabular-nums">{coinCount}</span>개 쌓임
          </p>
        </div>

        {showSignup ? (
          <div className="flex flex-col items-center gap-1 pb-1 border-l border-[#2A2A2A] pl-4 sm:pl-6">
            <p className="text-[10px] font-bold text-sky-300/90">가입 보너스</p>
            <div className="flex flex-col-reverse items-center">
              {Array.from({ length: signupCoins }, (_, i) => (
                <CoinEdge
                  key={i}
                  earned
                  tone="sky"
                  stackIndex={i + 1}
                  isTopEarned={i === signupCoins - 1}
                />
              ))}
            </div>
            <p className="text-[10px] font-black text-sky-300 tabular-nums">
              +{status.signup_bonus_amount}칩
            </p>
            <p className="text-[9px] text-gray-500 text-center max-w-[4.5rem]">가입 직후</p>
          </div>
        ) : null}
      </div>

      <p className="text-center text-xs text-white/75">
        <span className="font-bold text-amber-200">{schedule}</span> 일괄 지급 · 설문할수록 코인이
        쌓여요
      </p>

      {days >= max ? (
        <p className="text-center text-[11px] text-emerald-400/90 font-bold">이번 주 코인 만땅!</p>
      ) : status.next_tier_days != null && status.next_tier_bonus != null ? (
        <p className="text-center text-[11px] text-white/55">
          코인 하나 더 쌓으면{" "}
          <span className="font-bold text-amber-300 tabular-nums">+{status.next_tier_bonus}칩</span>{" "}
          구간
        </p>
      ) : null}
    </div>
  );
}
