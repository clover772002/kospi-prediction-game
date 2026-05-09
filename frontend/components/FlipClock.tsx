"use client";

import { useEffect, useState, useRef } from "react";

type CountdownInfo = { seconds: number; label: string; sublabel: string };

function getNextTradingOpen(from: Date): CountdownInfo {
  const target = new Date(from);
  target.setDate(target.getDate() + 1);
  target.setHours(9, 0, 0, 0);
  while (target.getDay() === 0 || target.getDay() === 6) target.setDate(target.getDate() + 1);
  const days = ["일","월","화","수","목","금","토"];
  const mm = String(target.getMonth() + 1).padStart(2, "0");
  const dd = String(target.getDate()).padStart(2, "0");
  return {
    seconds: Math.max(0, Math.floor((target.getTime() - from.getTime()) / 1000)),
    label: "장 시작까지",
    sublabel: `${mm}/${dd}(${days[target.getDay()]}) 09:00 개장`,
  };
}

function getCountdown(): CountdownInfo {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const day = kst.getDay();
  const mins = kst.getHours() * 60 + kst.getMinutes();

  // 주말이면 항상 다음 거래일 장시작까지
  if (day === 0 || day === 6) return getNextTradingOpen(kst);

  const target = new Date(kst);

  // 09:00 ~ 15:35 → 장마감까지
  if (mins >= 9 * 60 && mins < 15 * 60 + 35) {
    target.setHours(15, 35, 0, 0);
    return {
      seconds: Math.max(0, Math.floor((target.getTime() - kst.getTime()) / 1000)),
      label: "장마감까지",
      sublabel: "15:35 결과 공개",
    };
  }

  // 15:35 ~ 22:00 → 설문시작까지
  if (mins >= 15 * 60 + 35 && mins < 22 * 60) {
    target.setHours(22, 0, 0, 0);
    return {
      seconds: Math.max(0, Math.floor((target.getTime() - kst.getTime()) / 1000)),
      label: "설문 시작까지",
      sublabel: "22:00 설문 발송",
    };
  }

  // 22:00 ~ 09:00 → 다음 거래일 장시작까지
  return getNextTradingOpen(kst);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

const CARD_H = 40;
const HALF_H = CARD_H / 2;
const FONT_SIZE = 18;

function HalfDigit({ value, half, dim = false }: { value: string; half: "top" | "bottom"; dim?: boolean }) {
  return (
    <div
      style={{ height: HALF_H, overflow: "hidden", position: "relative" }}
      className={half === "top" ? "rounded-t-md bg-[#1E1E1E]" : "rounded-b-md bg-[#181818]"}
    >
      <div style={{ height: CARD_H, display: "flex", alignItems: "center", justifyContent: "center", marginTop: half === "bottom" ? -HALF_H : 0 }}>
        <span className="tabular-nums font-black select-none" style={{ fontSize: FONT_SIZE, lineHeight: 1, color: dim ? "rgba(255,255,255,0.5)" : "#fff", fontVariantNumeric: "tabular-nums" }}>
          {value}
        </span>
      </div>
    </div>
  );
}

function FlipCard({ digit, prevDigit }: { digit: string; prevDigit: string }) {
  const [animating, setAnimating] = useState(false);
  const prevRef = useRef(prevDigit);
  const savedPrev = prevRef.current;

  useEffect(() => {
    if (digit !== prevRef.current) {
      setAnimating(true);
      prevRef.current = digit;
      const t = setTimeout(() => setAnimating(false), 300);
      return () => clearTimeout(t);
    }
  }, [digit]);

  return (
    <div className="relative select-none rounded-md" style={{ width: 26, height: CARD_H, perspective: 200 }}>
      <HalfDigit value={digit} half="top" />
      <div style={{ height: 1, background: "#000", position: "relative", zIndex: 5 }} />
      <HalfDigit value={digit} half="bottom" dim />

      {animating && (
        <div className="flip-top" style={{ position: "absolute", top: 0, left: 0, right: 0, height: HALF_H, overflow: "hidden", zIndex: 10, transformOrigin: "bottom center", borderRadius: "4px 4px 0 0", background: "#2A2A2A" }}>
          <div style={{ height: CARD_H, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="tabular-nums font-black" style={{ fontSize: FONT_SIZE, lineHeight: 1, color: "#fff" }}>{savedPrev}</span>
          </div>
        </div>
      )}

      {animating && (
        <div className="flip-bottom" style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: HALF_H, overflow: "hidden", zIndex: 10, transformOrigin: "top center", borderRadius: "0 0 4px 4px", background: "#1E1E1E" }}>
          <div style={{ height: CARD_H, marginTop: -HALF_H, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="tabular-nums font-black" style={{ fontSize: FONT_SIZE, lineHeight: 1, color: "rgba(255,255,255,0.5)" }}>{digit}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FlipUnit({ value, label }: { value: string; label: string }) {
  const d0 = value[0], d1 = value[1];
  const prevD0 = useRef(d0), prevD1 = useRef(d1);
  const p0 = prevD0.current, p1 = prevD1.current;
  prevD0.current = d0;
  prevD1.current = d1;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-0.5">
        <FlipCard digit={d0} prevDigit={p0} />
        <FlipCard digit={d1} prevDigit={p1} />
      </div>
      <span className="text-[9px] text-gray-600 font-bold tracking-widest uppercase">{label}</span>
    </div>
  );
}

export default function FlipClock({ compact = false }: { compact?: boolean }) {
  const [info, setInfo] = useState<CountdownInfo | null>(null);

  useEffect(() => {
    setInfo(getCountdown());
    const id = setInterval(() => setInfo(getCountdown()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!info) return null;

  const h = Math.floor(info.seconds / 3600);
  const m = Math.floor((info.seconds % 3600) / 60);
  const s = info.seconds % 60;

  /* ── compact 모드: 헤더 옆 배치용 ── */
  if (compact) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <p className="text-[9px] text-gray-500 font-bold tracking-widest">{info.label}</p>
        <div className="flex items-center gap-1">
          <FlipUnit value={pad(h)} label="시" />
          <span className="text-sm font-black text-gray-600 pb-3">:</span>
          <FlipUnit value={pad(m)} label="분" />
          <span className="text-sm font-black text-gray-600 pb-3">:</span>
          <FlipUnit value={pad(s)} label="초" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0F0F0F] border border-[#2A2A2A] rounded-xl px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">{info.label}</p>
        <p className="text-[10px] text-gray-600">{info.sublabel}</p>
      </div>
      <div className="flex items-center justify-center gap-1.5">
        <FlipUnit value={pad(h)} label="시간" />
        <span className="text-base font-black text-gray-600 pb-3">:</span>
        <FlipUnit value={pad(m)} label="분" />
        <span className="text-base font-black text-gray-600 pb-3">:</span>
        <FlipUnit value={pad(s)} label="초" />
      </div>
    </div>
  );
}
