"use client";

import { useEffect, useState } from "react";

function formatRemaining(totalSec: number): string {
  if (totalSec <= 0) return "00:00:00";
  const days = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(h)}:${pad(m)}:${pad(s)}`;
  if (days > 0) return `${days}일 ${time}`;
  return time;
}

type Props = {
  roomOpen: boolean;
  roomCloseAt?: string | null;
  surveyDate?: string | null;
};

/** 소통방 제목 옆 — 해당 거래일 15:35 KST 장 마감(결과 확정)까지 */
export default function RoomCloseCountdown({ roomOpen, roomCloseAt, surveyDate }: Props) {
  const [secs, setSecs] = useState<number | null>(null);

  useEffect(() => {
    if (!roomOpen || !roomCloseAt) {
      setSecs(0);
      return;
    }
    const endMs = new Date(roomCloseAt).getTime();
    const tick = () => {
      if (Number.isNaN(endMs)) {
        setSecs(null);
        return;
      }
      setSecs(Math.max(0, Math.floor((endMs - Date.now()) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [roomOpen, roomCloseAt]);

  if (!surveyDate) return null;

  if (!roomOpen) {
    return (
      <div className="shrink-0 text-right">
        <p className="text-[10px] font-bold text-gray-500">톡방 종료</p>
        <p className="text-sm font-black text-gray-400 tabular-nums">종료됨</p>
      </div>
    );
  }

  const label =
    secs != null && secs <= 0 ? "곧 종료" : "종료까지";

  return (
    <div className="shrink-0 text-right min-w-[5.5rem]">
      <p className="text-[10px] font-bold text-gray-500">{label}</p>
      <p
        className={`text-sm font-black tabular-nums leading-tight ${
          secs != null && secs <= 3600 ? "text-amber-300" : "text-violet-200"
        }`}
      >
        {secs == null ? "—" : formatRemaining(secs)}
      </p>
    </div>
  );
}
