"use client";

import type { TeamChatCrownFxState } from "./useTeamChatCrownFx";
import { displayLabelWithoutCrown } from "./useTeamChatCrownFx";

type Props = {
  userId: string;
  displayLabel: string;
  time: string;
  isLeader: boolean;
  fx: TeamChatCrownFxState;
};

export default function TeamChatMessageLabel({
  userId,
  displayLabel,
  time,
  isLeader,
  fx,
}: Props) {
  const breaking = fx.breakingUid === userId;
  const crowning = fx.crowningUid === userId;
  const showSteady = isLeader && !breaking && !crowning;

  let crownClass = "team-chat-crown-steady";
  if (breaking) crownClass = "team-chat-crown-break";
  else if (crowning) crownClass = "team-chat-crown-sparkle";

  return (
    <span
      className={`mb-0.5 flex max-w-[90%] items-center gap-0.5 text-[10px] font-semibold ${
        crowning ? "team-chat-name-crown-hit" : ""
      }`}
    >
      {breaking || crowning || showSteady ? (
        <span className={`relative inline-block shrink-0 ${crownClass}`} aria-hidden>
          👑
          {breaking ? (
            <>
              <span className="team-chat-crown-shard team-chat-crown-shard-a" />
              <span className="team-chat-crown-shard team-chat-crown-shard-b" />
              <span className="team-chat-crown-shard team-chat-crown-shard-c" />
            </>
          ) : null}
          {crowning ? <span className="team-chat-crown-sparkles" aria-hidden /> : null}
        </span>
      ) : null}
      <span className={`truncate ${crowning ? "text-amber-200" : "text-gray-500"}`}>
        {displayLabelWithoutCrown(displayLabel)}
      </span>
      <span className="ml-1 shrink-0 font-normal text-gray-600">{time}</span>
    </span>
  );
}
