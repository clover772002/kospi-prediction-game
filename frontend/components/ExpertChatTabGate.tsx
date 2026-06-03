"use client";

/** 명예의 전당(초고수 소통): 최소 토큰 미만일 때 안내 */
export default function ExpertChatTabGate({
  myBalance,
  minBalance,
  tipPerMessage,
  reason,
  compact = false,
}: {
  myBalance: number;
  minBalance: number;
  tipPerMessage?: number;
  reason?: string | null;
  compact?: boolean;
}) {
  const need = Math.max(0, minBalance - myBalance);

  return (
    <div
      className={`mx-auto flex max-w-sm flex-col items-center justify-center rounded-3xl border border-[#2A2A2A] bg-[#1A1A1A] px-6 text-center shadow-2xl ${
        compact ? "mb-6 min-h-0 py-8" : "min-h-[min(70vh,520px)] py-10"
      }`}
    >
      <p className={`${compact ? "text-4xl mb-3" : "text-5xl mb-4"}`} aria-hidden>
        🔒
      </p>
      <h2 id="expert-tab-gate-title" className="text-xl font-black text-white leading-snug">
        초고수 소통은 아직 열리지 않았습니다
      </h2>
      <p className="mt-3 text-base text-white/90 leading-relaxed">
        {reason ?? `보유 토큰이 ${minBalance}개 이상이어야 초고수에게 질문·답장을 할 수 있습니다.`}
      </p>
      <div className="mt-5 w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 space-y-2 text-base">
        <p className="text-white">
          내 토큰 <span className="font-black tabular-nums text-amber-300">{myBalance}</span>개
        </p>
        <p className="text-white/90">
          필요 <span className="font-black tabular-nums text-amber-200">{minBalance}</span>개
          {need > 0 ? (
            <>
              {" "}
              · <span className="font-bold text-amber-100">약 {need}개 더</span>
            </>
          ) : null}
        </p>
        {tipPerMessage != null ? (
          <p className="text-sm text-white/80 pt-1 border-t border-amber-500/20">
            열린 뒤 질문 1통당 <span className="font-bold text-amber-200">{tipPerMessage}토큰</span>이
            사용됩니다.
          </p>
        ) : null}
      </div>
      <p className="mt-4 text-sm text-white/80 leading-relaxed">
        시작 토큰 100개에 더해, 설문 참여와 적중으로 토큰을 모으면 됩니다. 보통{" "}
        <span className="font-bold text-white">적중을 3번 정도</span> 쌓으면 열립니다.
      </p>
    </div>
  );
}
