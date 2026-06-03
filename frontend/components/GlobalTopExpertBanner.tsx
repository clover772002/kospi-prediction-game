"use client";

import Link from "next/link";

type Props = {
  receivesToday: boolean;
  compact?: boolean;
  expertChatHref?: string;
  expertChatUnlocked?: boolean;
};

export default function GlobalTopExpertBanner({
  receivesToday,
  compact = false,
  expertChatHref = "/expert-chat",
  expertChatUnlocked = true,
}: Props) {
  return (
    <div
      className={`rounded-2xl border border-violet-500/35 bg-gradient-to-br from-violet-950/50 to-indigo-950/30 ${
        compact ? "px-3 py-3" : "px-4 py-4"
      }`}
      role="status"
    >
      <p className={`font-black text-violet-100 ${compact ? "text-sm" : "text-base"}`}>
        <span className="mr-1" aria-hidden>
          ⭐
        </span>
        토큰 1위 — 초고수로 지정됐어요
      </p>
      <p className={`mt-1 leading-relaxed text-violet-200/90 ${compact ? "text-xs" : "text-sm"}`}>
        보유 토큰이 가장 많습니다. 다른 사람에게 질문을 받으면 토큰을 받을 수 있어요.
      </p>
      {receivesToday && expertChatUnlocked ? (
        <Link
          href={expertChatHref}
          className={`mt-2 inline-flex font-bold text-amber-200/95 underline-offset-2 hover:underline ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          명예의 전당에서 질문·답장 보기 →
        </Link>
      ) : receivesToday && !expertChatUnlocked ? (
        <p className={`mt-2 text-violet-300/70 ${compact ? "text-[11px]" : "text-xs"}`}>
          명예의 전당·초고수 소통은 토큰 210개 이상일 때 열립니다.
        </p>
      ) : !receivesToday ? (
        <p className={`mt-2 text-violet-300/70 ${compact ? "text-[11px]" : "text-xs"}`}>
          오늘 설문에 참여하면 그날 질문을 받을 수 있어요.
        </p>
      ) : null}
    </div>
  );
}

export function GlobalTopExpertDethronedBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-zinc-500/40 bg-gradient-to-br from-zinc-900/80 to-zinc-950/60 ${
        compact ? "px-3 py-3" : "px-4 py-4"
      }`}
      role="status"
    >
      <p className={`font-black text-zinc-200 ${compact ? "text-sm" : "text-base"}`}>
        <span className="mr-1" aria-hidden>
          💔
        </span>
        초고수 자리를 빼앗겼어요
      </p>
      <p className={`mt-1 leading-relaxed text-zinc-400 ${compact ? "text-xs" : "text-sm"}`}>
        다른 참가자가 토큰을 더 많이 보유하게 되었습니다. 적중·참여로 토큰을 모으면 다시 1위가 될 수 있어요.
      </p>
    </div>
  );
}
