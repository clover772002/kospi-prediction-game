"use client";

export const CHIP_ICON = "🪙";

/** 접근성·알림용 짧은 문자열 */
export function formatChipAmountText(amount: number): string {
  return `${amount.toLocaleString()}${CHIP_ICON}`;
}

type ChipAmountProps = {
  amount: number;
  compact?: boolean;
  large?: boolean;
  /** 주간 도장 등 강조 영역용 */
  xlarge?: boolean;
  muted?: boolean;
  className?: string;
  /** 금액 앞 + / − */
  sign?: "+" | "-" | null;
};

/** 370🪙 — 탭 공통 칩 표기 */
export function ChipAmount({
  amount,
  compact,
  large,
  xlarge,
  muted,
  className = "",
  sign = null,
}: ChipAmountProps) {
  const iconSize = xlarge
    ? "text-3xl sm:text-4xl"
    : large
      ? "text-2xl sm:text-3xl"
      : compact
        ? "text-sm"
        : "text-base";
  const textSize = xlarge
    ? "text-xl sm:text-2xl"
    : large
      ? "text-lg sm:text-xl"
      : compact
        ? "text-[9px] sm:text-[10px]"
        : "text-[10px] sm:text-xs";
  const prefix =
    sign === "+" ? "+" : sign === "-" ? "−" : "";

  return (
    <span
      className={`inline-flex items-center gap-0.5 leading-none tabular-nums ${className} ${
        muted ? "opacity-55" : ""
      }`}
    >
      <span
        className={`font-black tracking-tight ${textSize} ${muted ? "text-gray-500" : ""}`}
      >
        {prefix}
        {amount.toLocaleString()}
      </span>
      <span className={`${iconSize} leading-none`} aria-hidden>
        {CHIP_ICON}
      </span>
    </span>
  );
}

/** 10🪙 / 185🪙 */
export function ChipAmountFraction({
  current,
  max,
  compact,
  large,
  xlarge,
  className = "",
}: {
  current: number;
  max: number;
  compact?: boolean;
  large?: boolean;
  xlarge?: boolean;
  className?: string;
}) {
  const slashSize = xlarge
    ? "text-lg sm:text-xl"
    : large
      ? "text-base sm:text-lg"
      : compact
        ? "text-[10px]"
        : "text-xs sm:text-sm";
  const useCompact = compact && !large && !xlarge;
  const useLarge = large && !xlarge;
  return (
    <span
      className={`inline-flex items-center gap-1.5 sm:gap-2 tabular-nums ${className}`}
      aria-label={`${current} / ${max}`}
    >
      <ChipAmount
        amount={current}
        compact={useCompact}
        large={useLarge}
        xlarge={xlarge}
        className="text-amber-200"
      />
      <span className={`font-black text-gray-500 ${slashSize}`}>/</span>
      <ChipAmount
        amount={max}
        compact={useCompact}
        large={useLarge}
        xlarge={xlarge}
        muted
      />
    </span>
  );
}
