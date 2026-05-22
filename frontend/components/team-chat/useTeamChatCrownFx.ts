"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DirectionChatMessageRow } from "@/lib/api";

export type TeamChatCrownFxState = {
  screenZoom: boolean;
  breakingUid: string | null;
  crowningUid: string | null;
  banner: string | null;
};

const IDLE: TeamChatCrownFxState = {
  screenZoom: false,
  breakingUid: null,
  crowningUid: null,
  banner: null,
};

function crownNameFromMessage(m: DirectionChatMessageRow): string {
  const raw = m.display_label.replace(/^👑\s*/, "");
  const head = raw.split("·")[0]?.trim();
  return head || m.masked_name;
}

export function useTeamChatCrownFx(
  leaderId: string | null | undefined,
  boot: boolean,
  messages: DirectionChatMessageRow[],
): TeamChatCrownFxState {
  const prevLeaderRef = useRef<string | null>(null);
  const leaderInitRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const [fx, setFx] = useState<TeamChatCrownFxState>(IDLE);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  const resolveName = useCallback(
    (uid: string) => {
      const hit = messages.find((m) => m.user_id === uid);
      return hit ? crownNameFromMessage(hit) : "누군가";
    },
    [messages],
  );

  const runTransfer = useCallback(
    (from: string, to: string) => {
      clearTimers();
      const toName = resolveName(to);
      setFx({
        screenZoom: true,
        breakingUid: from,
        crowningUid: null,
        banner: null,
      });
      timersRef.current = [
        window.setTimeout(() => {
          setFx((prev) => ({
            ...prev,
            breakingUid: null,
            crowningUid: to,
            banner: `👑 ${toName}에게 왕관!`,
          }));
        }, 480),
        window.setTimeout(() => {
          setFx((prev) => ({ ...prev, screenZoom: false }));
        }, 950),
        window.setTimeout(() => {
          setFx(IDLE);
        }, 3400),
      ];
    },
    [clearTimers, resolveName],
  );

  useEffect(() => {
    if (boot) return;
    const next = leaderId ?? null;
    if (!leaderInitRef.current) {
      leaderInitRef.current = true;
      prevLeaderRef.current = next;
      return;
    }
    const prev = prevLeaderRef.current;
    if (prev && next && prev !== next) {
      runTransfer(prev, next);
    }
    prevLeaderRef.current = next;
  }, [leaderId, boot, runTransfer]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return fx;
}

export function displayLabelWithoutCrown(displayLabel: string): string {
  return displayLabel.replace(/^👑\s*/, "");
}
