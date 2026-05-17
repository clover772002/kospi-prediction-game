"use client";

import Link from "next/link";

/** 고수 탭·페이지: 토큰 200 미만일 때 전체 화면 안내 */
export default function ExpertChatTabGate({
  myBalance,
  minBalance,
  tipPerMessage,
  reason,
}: {
  myBalance: number;
  minBalance: number;
  tipPerMessage?: number;
  reason?: string | null;
}) {
  const need = Math.max(0, minBalance - myBalance);

  return (
    <div className="mx-auto flex min-h-[min(70vh,520px)] max-w-sm flex-col items-center justify-center rounded-3xl border border-[#2A2A2A] bg-[#1A1A1A] px-6 py-10 text-center shadow-2xl">
      <p className="text-5xl mb-4" aria-hidden>
        🔒
      </p>
      <h2 id="expert-tab-gate-title" className="text-xl font-black text-white leading-snug">
        고수 소통은 아직 열리지 않았습니다
      </h2>
      <p className="mt-3 text-base text-white/90 leading-relaxed">
        {reason ?? `보유 토큰이 ${minBalance}개 이상이어야 고수 탭을 이용할 수 있습니다.`}
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
        설문에 참여해 예측하고, 적중하면 토큰이 쌓입니다.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2">
        <Link
          href="/survey"
          className="w-full rounded-2xl bg-amber-500 py-3.5 text-base font-black text-white transition-colors hover:bg-amber-400 active:scale-[0.99]"
        >
          설문하러 가기
        </Link>
        <Link
          href="/dashboard"
          className="w-full rounded-2xl border border-[#333] bg-[#252525] py-3 text-base font-bold text-white transition-colors hover:bg-[#2A2A2A]"
        >
          대시보드에서 내 토큰 보기
        </Link>
      </div>
    </div>
  );
}
