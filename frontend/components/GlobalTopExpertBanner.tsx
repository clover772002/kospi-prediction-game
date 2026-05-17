"use client";

import Link from "next/link";

type Props = {
  /** 오늘(기준 거래일) 설문에 참여해 질문 수신 대상인지 */
  receivesToday: boolean;
  /** 설문 제출 직후 등 좁은 영역용 */
  compact?: boolean;
  expertChatHref?: string;
  expertChatUnlocked?: boolean;
};

/** 전역 최고 고수에게 표시하는 선정 안내 */
export default function GlobalTopExpertBanner({
  receivesToday,
  compact = false,
  expertChatHref = "/expert-chat",
  expertChatUnlocked = true,
}: Props) {
  const title = receivesToday
    ? "오늘의 최고 고수로 지정됐어요"
    : "누적 적중 1순위(최고 고수)입니다";
  const body = receivesToday
    ? "다른 참가자가 고수 탭에서 질문을 보낼 수 있어요. 알림을 켜 두면 푸시로도 받을 수 있습니다."
    : "오늘 설문에 참여하면 그날 질문을 받을 수 있어요.";

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
        {title}
      </p>
      <p className={`mt-1 leading-relaxed text-violet-200/90 ${compact ? "text-xs" : "text-sm"}`}>
        {body}
      </p>
      {receivesToday && expertChatUnlocked ? (
        <Link
          href={expertChatHref}
          className={`mt-2 inline-flex font-bold text-amber-200/95 underline-offset-2 hover:underline ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          고수 탭에서 질문·답장 보기 →
        </Link>
      ) : receivesToday && !expertChatUnlocked ? (
        <p className={`mt-2 text-violet-300/70 ${compact ? "text-[11px]" : "text-xs"}`}>
          고수 탭은 토큰 210개 이상일 때 열립니다. 질문은 그때 확인할 수 있어요.
        </p>
      ) : null}
    </div>
  );
}
