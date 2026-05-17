"use client";

import { useEffect, useState, useRef } from "react";

type CountdownInfo = { seconds: number; label: string; sublabel: string };

function getNextTradingOpen(from: Date): CountdownInfo {
  const target = new Date(from);
  target.setDate(target.getDate() + 1);
  target.setHours(9, 0, 0, 0);
  while (target.getDay() === 0 || target.getDay() === 6) target.setDate(target.getDate() + 1);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
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

  if (day === 0 || day === 6) return getNextTradingOpen(kst);

  const target = new Date(kst);

  if (mins >= 9 * 60 && mins < 15 * 60 + 35) {
    target.setHours(15, 35, 0, 0);
    return {
      seconds: Math.max(0, Math.floor((target.getTime() - kst.getTime()) / 1000)),
      label: "장마감까지",
      sublabel: "15:35 결과 공개",
    };
  }

  if (mins >= 15 * 60 + 35 && mins < 22 * 60) {
    target.setHours(22, 0, 0, 0);
    return {
      seconds: Math.max(0, Math.floor((target.getTime() - kst.getTime()) / 1000)),
      label: "설문 시작까지",
      sublabel: "22:00 설문 발송",
    };
  }

  return getNextTradingOpen(kst);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

type DigitDim = { cardH: number; fontSize: number; w: number };

const DIGIT_MD: DigitDim = { cardH: 40, fontSize: 18, w: 26 };
/** 설문 헤더(compact): 가독성 확대 */
const DIGIT_LG: DigitDim = { cardH: 50, fontSize: 23, w: 32 };

function HalfDigit({
  value,
  half,
  dim = false,
  d,
}: {
  value: string;
  half: "top" | "bottom";
  dim?: boolean;
  d: DigitDim;
}) {
  const halfH = d.cardH / 2;
  return (
    <div
      style={{ height: halfH, overflow: "hidden", position: "relative" }}
      className={half === "top" ? "rounded-t-md bg-[#1E1E1E]" : "rounded-b-md bg-[#181818]"}
    >
      <div
        style={{
          height: d.cardH,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: half === "bottom" ? -halfH : 0,
        }}
      >
        <span
          className="tabular-nums font-black select-none"
          style={{
            fontSize: d.fontSize,
            lineHeight: 1,
            color: dim ? "rgba(255,255,255,0.5)" : "#fff",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function FlipCard({ digit, prevDigit, d }: { digit: string; prevDigit: string; d: DigitDim }) {
  const [animating, setAnimating] = useState(false);
  const prevRef = useRef(prevDigit);
  const savedPrev = prevRef.current;
  const halfH = d.cardH / 2;

  useEffect(() => {
    if (digit !== prevRef.current) {
      setAnimating(true);
      prevRef.current = digit;
      const t = setTimeout(() => setAnimating(false), 300);
      return () => clearTimeout(t);
    }
  }, [digit]);

  return (
    <div className="relative select-none rounded-md" style={{ width: d.w, height: d.cardH, perspective: 200 }}>
      <HalfDigit value={digit} half="top" d={d} />
      <div style={{ height: 1, background: "#000", position: "relative", zIndex: 5 }} />
      <HalfDigit value={digit} half="bottom" dim d={d} />

      {animating && (
        <div
          className="flip-top"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: halfH,
            overflow: "hidden",
            zIndex: 10,
            transformOrigin: "bottom center",
            borderRadius: "4px 4px 0 0",
            background: "#2A2A2A",
          }}
        >
          <div style={{ height: d.cardH, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="tabular-nums font-black" style={{ fontSize: d.fontSize, lineHeight: 1, color: "#fff" }}>
              {savedPrev}
            </span>
          </div>
        </div>
      )}

      {animating && (
        <div
          className="flip-bottom"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: halfH,
            overflow: "hidden",
            zIndex: 10,
            transformOrigin: "top center",
            borderRadius: "0 0 4px 4px",
            background: "#1E1E1E",
          }}
        >
          <div style={{ height: d.cardH, marginTop: -halfH, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="tabular-nums font-black" style={{ fontSize: d.fontSize, lineHeight: 1, color: "rgba(255,255,255,0.5)" }}>
              {digit}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function FlipUnit({
  value,
  label,
  d,
  labelClassName,
}: {
  value: string;
  label: string;
  d: DigitDim;
  labelClassName?: string;
}) {
  const d0 = value[0];
  const d1 = value[1];
  const prevD0 = useRef(d0);
  const prevD1 = useRef(d1);
  const p0 = prevD0.current;
  const p1 = prevD1.current;
  prevD0.current = d0;
  prevD1.current = d1;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-0.5">
        <FlipCard digit={d0} prevDigit={p0} d={d} />
        <FlipCard digit={d1} prevDigit={p1} d={d} />
      </div>
      <span className={labelClassName ?? "text-[9px] text-gray-600 font-bold tracking-widest uppercase"}>{label}</span>
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

  if (compact) {
    const d = DIGIT_LG;
    const colonPb = Math.max(18, Math.round(d.cardH * 0.55));
    return (
      <div className="flex flex-col items-end gap-1">
        <p className="text-sm font-bold text-gray-500 tracking-wide">{info.label}</p>
        <div className="flex items-center gap-1">
          <FlipUnit value={pad(h)} label="시" d={d} labelClassName="text-xs text-gray-500 font-bold" />
          <span className={`font-black text-gray-600`} style={{ fontSize: d.fontSize, paddingBottom: colonPb }}>
            :
          </span>
          <FlipUnit value={pad(m)} label="분" d={d} labelClassName="text-xs text-gray-500 font-bold" />
          <span className={`font-black text-gray-600`} style={{ fontSize: d.fontSize, paddingBottom: colonPb }}>
            :
          </span>
          <FlipUnit value={pad(s)} label="초" d={d} labelClassName="text-xs text-gray-500 font-bold" />
        </div>
      </div>
    );
  }

  const d = DIGIT_MD;
  return (
    <div className="bg-[#0F0F0F] border border-[#2A2A2A] rounded-xl px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">{info.label}</p>
        <p className="text-[10px] text-gray-600">{info.sublabel}</p>
      </div>
      <div className="flex items-center justify-center gap-1.5">
        <FlipUnit value={pad(h)} label="시간" d={d} />
        <span className="text-base font-black text-gray-600 pb-3">:</span>
        <FlipUnit value={pad(m)} label="분" d={d} />
        <span className="text-base font-black text-gray-600 pb-3">:</span>
        <FlipUnit value={pad(s)} label="초" d={d} />
      </div>
    </div>
  );
}
