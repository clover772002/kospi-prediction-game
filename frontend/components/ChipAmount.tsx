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
  muted,
  className = "",
  sign = null,
}: ChipAmountProps) {
  const iconSize = large ? "text-2xl" : compact ? "text-sm" : "text-base";
  const textSize = large
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
  className = "",
}: {
  current: number;
  max: number;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 tabular-nums ${className}`}
      aria-label={`${current} / ${max}`}
    >
      <ChipAmount amount={current} compact={compact} className="text-amber-200" />
      <span className={`font-black text-gray-500 ${compact ? "text-[10px]" : "text-xs"}`}>/</span>
      <ChipAmount amount={max} compact={compact} muted />
    </span>
  );
}
