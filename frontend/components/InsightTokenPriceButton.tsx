"use client";

type Props = {
  priceTokens: number;
  /** 칩 안에 항상 보이는 짧은 예시(설명글은 접힌 상세 영역 참고). */
  instantExample?: string;
  className: string;
  locked: boolean;
  unlocking: boolean;
  onActivate: () => void;
};

/** 제목 옆에 붙는 `N 토큰` 칩 — 잠금 중일 때 눌러 곧바로 결제 플로우(잠금 해제 요청). */
export default function InsightTokenPriceButton({
  priceTokens,
  instantExample,
  className,
  locked,
  unlocking,
  onActivate,
}: Props) {
  const labelCore = instantExample
    ? `${priceTokens} 토큰. ${instantExample}`
    : `${priceTokens} 토큰`;
  return (
    <button
      type="button"
      onClick={() => {
        if (locked && !unlocking) void onActivate();
      }}
      disabled={unlocking}
      aria-label={locked ? `${labelCore} — 잠금 해제 요청` : `이미 열람됨(기준 ${priceTokens} 토큰). ${instantExample ?? ""}`}
      className={`rounded-lg px-2.5 py-1.5 text-left max-w-[11.5rem] border transition-all ${
        locked
          ? `${className} active:scale-[0.97] disabled:opacity-50`
          : `${className} opacity-50 cursor-default`
      }`}
    >
      <span className="block text-[11px] font-black tabular-nums whitespace-nowrap">{priceTokens} 토큰</span>
      {instantExample ? (
        <span className="mt-0.5 block text-[9px] font-normal leading-snug opacity-90 line-clamp-2 text-balance">
          {instantExample}
        </span>
      ) : null}
    </button>
  );
}
