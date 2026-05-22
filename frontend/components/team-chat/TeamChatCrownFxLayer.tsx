"use client";

import type { TeamChatCrownFxState } from "./useTeamChatCrownFx";

type Props = {
  fx: TeamChatCrownFxState;
};

/** 왕관 이전 시 화면 플래시·배너 */
export default function TeamChatCrownFxLayer({ fx }: Props) {
  const active = fx.screenZoom || fx.banner;
  if (!active) return null;

  return (
    <>
      {fx.screenZoom ? (
        <div className="team-chat-crown-overlay pointer-events-none fixed inset-0 z-[55]" aria-hidden />
      ) : null}
      {fx.banner ? (
        <div
          className="team-chat-crown-banner pointer-events-none fixed left-1/2 top-[calc(3.5rem+env(safe-area-inset-top))] z-[56] -translate-x-1/2"
          role="status"
          aria-live="polite"
        >
          {fx.banner}
        </div>
      ) : null}
    </>
  );
}
