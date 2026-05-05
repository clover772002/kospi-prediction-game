"use client";

import { useEffect, useState, useRef } from "react";

function getSecondsUntilNextSurvey(): number {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));

  const todaySurvey = new Date(kst);
  todaySurvey.setHours(8, 48, 0, 0);

  let target = new Date(todaySurvey);
  if (kst >= todaySurvey) {
    target.setDate(target.getDate() + 1);
  }
  // 주말 건너뛰기
  while (target.getDay() === 0 || target.getDay() === 6) {
    target.setDate(target.getDate() + 1);
  }

  return Math.max(0, Math.floor((target.getTime() - kst.getTime()) / 1000));
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function FlipCard({ digit, prevDigit }: { digit: string; prevDigit: string }) {
  const [animating, setAnimating] = useState(false);
  const prevRef = useRef(prevDigit);

  useEffect(() => {
    if (digit !== prevRef.current) {
      setAnimating(true);
      prevRef.current = digit;
      const t = setTimeout(() => setAnimating(false), 320);
      return () => clearTimeout(t);
    }
  }, [digit]);

  return (
    <div
      className="relative w-9 h-12 rounded-md overflow-hidden select-none"
      style={{ perspective: "200px" }}
    >
      {/* 상단 고정 (현재값) */}
      <div className="absolute inset-x-0 top-0 h-1/2 bg-[#1C1C1C] flex items-end justify-center overflow-hidden rounded-t-md border-b border-black/60">
        <span className="text-2xl font-black text-white tabular-nums leading-none pb-0.5">{digit}</span>
      </div>
      {/* 하단 고정 (현재값) */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[#161616] flex items-start justify-center overflow-hidden rounded-b-md">
        <span className="text-2xl font-black text-white/80 tabular-nums leading-none -mt-[14px]">{digit}</span>
      </div>

      {/* 플립 상단 (이전값 → 내려가며 사라짐) */}
      {animating && (
        <div
          className="absolute inset-x-0 top-0 h-1/2 bg-[#242424] flex items-end justify-center overflow-hidden rounded-t-md border-b border-black/60 flip-top z-10"
        >
          <span className="text-2xl font-black text-white tabular-nums leading-none pb-0.5">{prevRef.current}</span>
        </div>
      )}
      {/* 플립 하단 (새값 → 위에서 내려옴) */}
      {animating && (
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 bg-[#1C1C1C] flex items-start justify-center overflow-hidden rounded-b-md flip-bottom z-10"
        >
          <span className="text-2xl font-black text-white tabular-nums leading-none -mt-[14px]">{digit}</span>
        </div>
      )}

      {/* 중앙 구분선 */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-black/80 z-20" />
    </div>
  );
}

function FlipUnit({ value, label }: { value: string; label: string }) {
  const d0 = value[0];
  const d1 = value[1];
  const prevD0 = useRef(d0);
  const prevD1 = useRef(d1);

  const p0 = prevD0.current;
  const p1 = prevD1.current;
  prevD0.current = d0;
  prevD1.current = d1;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex gap-0.5">
        <FlipCard digit={d0} prevDigit={p0} />
        <FlipCard digit={d1} prevDigit={p1} />
      </div>
      <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">{label}</span>
    </div>
  );
}

export default function FlipClock() {
  const [secs, setSecs] = useState<number | null>(null);

  useEffect(() => {
    setSecs(getSecondsUntilNextSurvey());
    const id = setInterval(() => setSecs(getSecondsUntilNextSurvey()), 1000);
    return () => clearInterval(id);
  }, []);

  if (secs === null) return null;

  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;

  return (
    <div className="bg-[#0F0F0F] border border-[#2A2A2A] rounded-2xl p-4">
      <p className="text-xs text-gray-500 text-center mb-3 tracking-widest uppercase">다음 설문까지</p>
      <div className="flex items-center justify-center gap-2">
        <FlipUnit value={pad(h)} label="시간" />
        <span className="text-2xl font-black text-gray-600 mb-4">:</span>
        <FlipUnit value={pad(m)} label="분" />
        <span className="text-2xl font-black text-gray-600 mb-4">:</span>
        <FlipUnit value={pad(s)} label="초" />
      </div>
      <p className="text-xs text-gray-600 text-center mt-3">
        다음 영업일 <span className="text-white font-bold">08:48</span> 설문 발송
      </p>
    </div>
  );
}
